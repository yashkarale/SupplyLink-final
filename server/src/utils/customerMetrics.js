import { createHash } from "node:crypto";

const cleanText = (value) => typeof value === "string" ? value.trim() : "";

export const normalizeCustomerEmail = (value) => cleanText(value).toLocaleLowerCase("en-US");

// Preserve whether the number was explicitly international. A local number is
// never assigned a country code based on a seller's location.
export const normalizeCustomerPhone = (value) => {
  const raw = cleanText(value);
  if (!raw || /[^\d\s()+.-]/.test(raw)) return "";
  const international = raw.startsWith("+") || raw.startsWith("00");
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("00")) digits = digits.slice(2);
  if (digits.length < 7 || digits.length > 15) return "";
  return `${international ? "+" : ""}${digits}`;
};

export const isRecognizedRevenueOrder = (order) => {
  const status = String(order?.orderStatus || "").toUpperCase();
  const paymentStatus = String(order?.paymentStatus || "").toUpperCase();
  if (["CANCELLED", "RETURNED"].includes(status)) return false;
  if (paymentStatus === "FAILED") return false;
  return paymentStatus === "VERIFIED"
    || (String(order?.paymentMethod || "").toUpperCase() === "COD" && status === "DELIVERED");
};

export const summarizeOrderValues = (orders = []) => {
  const safeOrders = Array.isArray(orders) ? orders.filter((order) => order && typeof order === "object") : [];
  const valueOf = (order) => {
    const amount = Number(order.totalAmount);
    return Number.isFinite(amount) ? amount : 0;
  };
  return {
    grossOrderValue: safeOrders.reduce((sum, order) => sum + valueOf(order), 0),
    recognizedSales: safeOrders.filter(isRecognizedRevenueOrder).reduce((sum, order) => sum + valueOf(order), 0),
    pendingPaymentValue: safeOrders.filter((order) => String(order.paymentStatus || "").toUpperCase() === "PENDING"
      && !["CANCELLED", "RETURNED"].includes(String(order.orderStatus || "").toUpperCase())
      && !(String(order.paymentMethod || "").toUpperCase() === "COD" && String(order.orderStatus || "").toUpperCase() === "DELIVERED"))
      .reduce((sum, order) => sum + valueOf(order), 0),
    failedPaymentValue: safeOrders.filter((order) => String(order.paymentStatus || "").toUpperCase() === "FAILED")
      .reduce((sum, order) => sum + valueOf(order), 0),
    cancelledOrderValue: safeOrders.filter((order) => String(order.orderStatus || "").toUpperCase() === "CANCELLED")
      .reduce((sum, order) => sum + valueOf(order), 0),
    refundTrackingSupported: false,
  };
};

const orderIdentity = (order, index) => String(order?._id || order?.id || order?.orderReference || `row-${index}`);

const customerIdentity = (email, phone, orderId) => {
  const material = email && phone ? `pair:${email}\u0000${phone}`
    : email ? `email:${email}`
      : phone ? `phone:${phone}`
        : `guest-order:${orderId}`;
  return createHash("sha256").update(material).digest("hex");
};

export const aggregateCustomers = (orders = []) => {
  const customers = new Map();
  const seenOrders = new Set();
  for (const [index, order] of (Array.isArray(orders) ? orders : []).entries()) {
    if (!order || typeof order !== "object") continue;
    const orderId = orderIdentity(order, index);
    if (seenOrders.has(orderId)) continue;
    seenOrders.add(orderId);

    const contact = order.customer && typeof order.customer === "object" ? order.customer : {};
    const email = normalizeCustomerEmail(contact.email);
    const phone = normalizeCustomerPhone(contact.phone);
    const key = customerIdentity(email, phone, orderId);
    const name = cleanText(contact.name) || "Guest customer";
    const timestamp = order.createdAt ? new Date(order.createdAt).getTime() : 0;
    const safeTime = Number.isFinite(timestamp) ? timestamp : 0;
    const total = Number(order.totalAmount ?? order.total);
    const amount = Number.isFinite(total) ? total : 0;
    const item = customers.get(key) || {
      key,
      name,
      email: cleanText(contact.email),
      phone: cleanText(contact.phone),
      address: "",
      city: "",
      postalCode: "",
      orderCount: 0,
      recognizedSpend: 0,
      lastOrderAt: "",
      lastOrderTime: 0,
      orders: [],
    };
    item.orderCount += 1;
    if (isRecognizedRevenueOrder(order)) item.recognizedSpend += amount;
    item.orders.push({
      reference: cleanText(order.orderReference) || String(order._id || order.id || "Order reference unavailable"),
      status: String(order.orderStatus || "PENDING").toUpperCase(),
      createdAt: order.createdAt || "",
      total: amount,
      paymentMethod: String(order.paymentMethod || "Unknown").toUpperCase(),
      paymentStatus: String(order.paymentStatus || "PENDING").toUpperCase(),
    });
    if (safeTime >= item.lastOrderTime) {
      item.lastOrderTime = safeTime;
      item.lastOrderAt = order.createdAt || "";
      item.name = name;
      item.address = cleanText(contact.address);
      item.city = cleanText(contact.city);
      item.postalCode = cleanText(contact.postalCode);
    }
    customers.set(key, item);
  }

  return [...customers.values()]
    .map((customer) => ({
      ...customer,
      initials: customer.name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "CU",
      orders: customer.orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    }))
    .sort((a, b) => b.lastOrderTime - a.lastOrderTime);
};
