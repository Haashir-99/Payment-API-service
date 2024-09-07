const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const paymentSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    orderId: {
      type: String,
      required: true,
    },
    paymentId: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "PKR",
    },
    paymentMethod: {
      type: String, // 'credit_card', 'paypal'
      required: true,
    },
    status: {
      type: String, //  'pending', 'completed', 'failed', 'refunded', "awaiting_payment"
      required: true,
      default: "pending",
    },
    transactionDetails: {
      type: Object,
      required: true,
      default: {},
    },
    refundDetails: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
