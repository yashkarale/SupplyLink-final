import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  // Order ownership is keyed by the authenticated User id throughout the API.
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  clientRequestId: { type: String, default: undefined, select: false },
  orderReference: { type: String, required: true, unique: true },
  trackingTokenHash: { type: String, select: false, unique: true, sparse: true },
  trackingTokenExpiresAt: { type: Date, default: null },
  paymentProofTokenHash: { type: String, select: false, unique: true, sparse: true },
  paymentProofTokenExpiresAt: { type: Date, default: null, select: false },
  paymentPendingUntil: { type: Date, default: null },
  paymentProofPublicId: { type: String, default: "", select: false },
  paymentProofFormat: { type: String, default: "", select: false },
  paymentProofUploadedAt: { type: Date, default: null },
  paymentProofDeleteAfter: { type: Date, default: null, select: false },
  paymentProofDeletedAt: { type: Date, default: null },
  customer: {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    postalCode: { type: String, trim: true, default: '' },
    address: { type: String, required: true, trim: true },
    notes: { type: String, default: '', trim: true },
  },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    variant: { type: String, default: null },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true },
  }],
  subtotal: { type: Number, required: true, default: 0 },
  shippingAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['UPI', 'COD', 'CARD', 'BANK_TRANSFER', 'WHATSAPP'], required: true },
  paymentStatus: { type: String, enum: ['PENDING', 'VERIFIED', 'FAILED'], default: 'PENDING' },
  paymentVerificationMethod: { type: String, enum: ['PROVIDER', 'SELLER_MANUAL'], default: null },
  paymentVerifiedAt: { type: Date, default: null },
  paymentVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  orderStatus: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'],
    default: 'PENDING'
  },
  statusHistory: [{
    from: { type: String, required: true },
    to: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
  }],
  emailDelivery: [{
    recipient: { type: String, enum: ['seller', 'buyer'], required: true },
    status: { type: String, enum: ['not_configured', 'accepted', 'sent', 'delivered', 'delayed', 'bounced', 'complained', 'failed', 'skipped'], required: true },
    providerMessageId: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

orderSchema.index({ paymentMethod: 1, paymentStatus: 1, orderStatus: 1, paymentPendingUntil: 1 });
orderSchema.index({ sellerId: 1, clientRequestId: 1 }, {
  unique: true,
  partialFilterExpression: { clientRequestId: { $type: "string" } },
});

export default mongoose.model('Order', orderSchema);
