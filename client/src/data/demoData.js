
export const demoSales = [
  { day: "Mon", revenue: 4200, orders: 12 },
  { day: "Tue", revenue: 5800, orders: 18 },
  { day: "Wed", revenue: 4600, orders: 14 },
  { day: "Thu", revenue: 7200, orders: 22 },
  { day: "Fri", revenue: 6100, orders: 19 },
  { day: "Sat", revenue: 8900, orders: 28 },
  { day: "Sun", revenue: 7600, orders: 24 },
];

export const demoProducts = [
  { id: "PRD-001", name: "Classic Cotton Shirt", category: "Apparel", price: 899, stock: 42, sold: 86, status: "Active", color: "#dce8df", initials: "CS" },
  { id: "PRD-002", name: "Minimal Leather Wallet", category: "Accessories", price: 599, stock: 8, sold: 64, status: "Active", color: "#e9dfd3", initials: "LW" },
  { id: "PRD-003", name: "Everyday Tote Bag", category: "Bags", price: 749, stock: 3, sold: 51, status: "Active", color: "#e4e1f1", initials: "TB" },
  { id: "PRD-004", name: "Ceramic Coffee Mug", category: "Home", price: 349, stock: 27, sold: 43, status: "Active", color: "#f0e5cf", initials: "CM" },
  { id: "PRD-005", name: "Essential Phone Stand", category: "Accessories", price: 299, stock: 0, sold: 31, status: "Out of stock", color: "#dce7ef", initials: "PS" },
  { id: "PRD-006", name: "Linen Summer Shirt", category: "Apparel", price: 1099, stock: 19, sold: 29, status: "Active", color: "#e8e5d9", initials: "LS" },
];

export const demoOrders = [
  { id: "SL-2081", customer: "Aarav Sharma", email: "aarav@example.com", date: "Today, 11:42 AM", items: 2, total: 1498, status: "Processing", method: "UPI" },
  { id: "SL-2080", customer: "Priya Patel", email: "priya@example.com", date: "Today, 10:18 AM", items: 1, total: 899, status: "Confirmed", method: "Card" },
  { id: "SL-2079", customer: "Rohan Mehta", email: "rohan@example.com", date: "Yesterday, 5:36 PM", items: 3, total: 1947, status: "Shipped", method: "COD" },
  { id: "SL-2078", customer: "Ananya Desai", email: "ananya@example.com", date: "Yesterday, 2:10 PM", items: 2, total: 1098, status: "Delivered", method: "UPI" },
  { id: "SL-2077", customer: "Kabir Joshi", email: "kabir@example.com", date: "Oct 07, 4:24 PM", items: 1, total: 749, status: "Cancelled", method: "Card" },
  { id: "SL-2076", customer: "Meera Shah", email: "meera@example.com", date: "Oct 07, 1:05 PM", items: 2, total: 1248, status: "Delivered", method: "UPI" },
];

export const demoCustomers = [
  { id: "CUS-001", name: "Aarav Sharma", email: "aarav@example.com", orders: 8, spent: 12450, lastOrder: "Today", segment: "Loyal", initials: "AS" },
  { id: "CUS-002", name: "Priya Patel", email: "priya@example.com", orders: 5, spent: 8790, lastOrder: "Today", segment: "Returning", initials: "PP" },
  { id: "CUS-003", name: "Rohan Mehta", email: "rohan@example.com", orders: 1, spent: 1947, lastOrder: "Yesterday", segment: "New", initials: "RM" },
  { id: "CUS-004", name: "Ananya Desai", email: "ananya@example.com", orders: 4, spent: 6240, lastOrder: "Yesterday", segment: "Returning", initials: "AD" },
  { id: "CUS-005", name: "Kabir Joshi", email: "kabir@example.com", orders: 2, spent: 1798, lastOrder: "2 days ago", segment: "At risk", initials: "KJ" },
  { id: "CUS-006", name: "Meera Shah", email: "meera@example.com", orders: 7, spent: 11320, lastOrder: "2 days ago", segment: "Loyal", initials: "MS" },
];

export const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);