const Payment = require("../models/payment");
const stripe = require("stripe")(process.env.STRIPE_KEY);
const axios = require("axios");
const mongoose = require("mongoose");

const currencySymbols = {
  usd: "$", // US Dollar
  eur: "€", // Euro
  gbp: "£", // British Pound
  pkr: "Rs.", // Pakistani Rupee
  inr: "₹", // Indian Rupee
  aud: "A$", // Australian Dollar
  cad: "C$", // Canadian Dollar
  jpy: "¥", // Japanese Yen (although not divisible by 100, yen is an exception since it doesn't use decimal units)
  cny: "¥", // Chinese Yuan
  chf: "CHF", // Swiss Franc
  zar: "R", // South African Rand
  mxn: "$", // Mexican Peso
  nzd: "NZ$", // New Zealand Dollar
  sgd: "S$", // Singapore Dollar
  hkd: "HK$", // Hong Kong Dollar
  sek: "kr", // Swedish Krona
  nok: "kr", // Norwegian Krone
  dkk: "kr", // Danish Krone
  brl: "R$", // Brazilian Real
  rub: "₽", // Russian Ruble
  krw: "₩", // South Korean Won
  thb: "฿", // Thai Baht
  myr: "RM", // Malaysian Ringgit
  php: "₱", // Philippine Peso
  pln: "zł", // Polish Zloty
  czk: "Kč", // Czech Koruna
  huf: "Ft", // Hungarian Forint
  try: "₺", // Turkish Lira
  ils: "₪", // Israeli New Shekel
  egp: "£", // Egyptian Pound
  idr: "Rp", // Indonesian Rupiah
  vnd: "₫", // Vietnamese Dong
  aed: "د.إ", // UAE Dirham
  sar: "﷼", // Saudi Riyal
  qar: "﷼", // Qatari Riyal
  kwd: "KD", // Kuwaiti Dinar
  omr: "﷼", // Omani Rial
  bdt: "৳", // Bangladeshi Taka
  lkr: "Rs.", // Sri Lankan Rupee
  ngn: "₦", // Nigerian Naira
  kes: "KSh", // Kenyan Shilling
  ghs: "GH₵", // Ghanaian Cedi
  ars: "$", // Argentine Peso
  clp: "$", // Chilean Peso
  cop: "$", // Colombian Peso
  pen: "S/.", // Peruvian Sol
  uah: "₴", // Ukrainian Hryvnia
  ron: "lei", // Romanian Leu
  bgn: "лв", // Bulgarian Lev
  hrk: "kn", // Croatian Kuna
  isl: "kr", // Icelandic Krona
};

function getCurrencySymbol(currencyCode) {
  return (
    currencySymbols[currencyCode.toLowerCase()] || currencyCode.toUpperCase()
  );
}

exports.paymentIntent = async (req, res, next) => {
  const userId = req.userId;
  const { orderId, amount, currency, paymentMethod } = req.body;

  try {
    if (!orderId || !amount || !currency || !paymentMethod) {
      const error = new Error("Missing entries");
      error.statusCode = 422;
      throw error;
    }

    if (paymentMethod === "cash_on_delivery") {
      const payment = new Payment({
        userId: userId,
        orderId: orderId,
        paymentId: orderId,
        amount: amount,
        currency: currency,
        paymentMethod: paymentMethod,
        status: "pending",
        transactionDetails: {},
      });

      savedPayment = await payment.save();

      return res.status(200).json({
        message: "Order placed successfully with Cash on Delivery",
        paymentId: savedPayment._id,
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      payment_method_types: [paymentMethod],
    });

    const payment = new Payment({
      userId: userId,
      orderId: orderId,
      paymentId: paymentIntent.id,
      amount: amount,
      currency: currency,
      paymentMethod: paymentMethod,
      status: "pending",
      transactionDetails: {},
    });

    savedPayment = await payment.save();

    res.status(200).json({
      message: "Payment initiated successfully",
      clientSecret: paymentIntent.client_secret,
      paymentId: savedPayment._id,
    });
  } catch (err) {
    next(err);
  }
};

exports.confirmPayment = async (req, res, next) => {
  const { paymentId, paymentMethod } = req.body;
  const email = req.email;

  try {
    if (!paymentId) {
      const error = new Error("Payment ID / Method not provided");
      error.statusCode = 400;
      throw error;
    }

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      const error = new Error("Order / Payment not found");
      error.statusCode = 404;
      throw error;
    }

    let templateId = 5;
    let subject = "Payment Successful";

    if (paymentMethod === "cash_on_delivery") {
      payment.status = "awaiting_payment";
      templateId = 6;
      subject = "Order Placed Successful";
    } else {
      const paymentIntent = await stripe.paymentIntents.confirm(
        payment.paymentId,
        {
          payment_method: paymentMethod || "pm_card_visa",
        }
      );

      payment.status =
        paymentIntent.status === "succeeded" ? "completed" : "failed";
      payment.transactionDetails = paymentIntent;
    }

    await payment.save();

    const name = email.split("@")[0];
    const address = "Example Address";
    const currencySymbol = getCurrencySymbol(payment.currency);
    const trackingLink = "https://sampleTrackingLink/orderId.com";
    const supportEmail = "sampleSupport@email.com";

    await axios.post("http://localhost:4000/api/mail/send-transactional", {
      recipient: {
        email: email,
        name: name,
      },
      subject: subject,
      templateId: templateId,
      params: {
        orderId: payment.orderId,
        amount: (payment.amount / 100).toFixed(2),
        currencySymbol: currencySymbol,
        paymentMethod: payment.paymentMethod,
        address: address,
        trackingLink: trackingLink,
        supportEmail: supportEmail,
      },
    });

    if (paymentMethod === "cash_on_delivery") {
      return res
        .status(200)
        .json({ message: "Order confirmed with Cash on Delivery", payment });
    }
    res
      .status(200)
      .json({ message: "Payment confirmed successfully", payment });
  } catch (err) {
    next(err);
  }
};

exports.updatePaymentStatus = async (req, res, next) => {
  const { paymentId, status } = req.body;

  try {
    if (!paymentId || !status) {
      const error = new Error("Payment ID / staus not provided");
      error.statusCode = 400;
      throw error;
    }

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      const error = new Error("Order not found");
      error.statusCode = 404;
      throw error;
    }

    payment.status = status;
    await payment.save();

    res.status(200).json({
      message: `Order status updated to ${status}`,
      payment,
    });
  } catch (err) {
    next(err);
  }
};

exports.paymentStatus = async (req, res, next) => {
  const paymentId = req.params.paymentId;
  const userId = req.userId;
  try {
    if (!paymentId) {
      const error = new Error("Payment ID not provided");
      error.statusCode = 400;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      const error = new Error("Invalid Payment ID format");
      error.statusCode = 400;
      throw error;
    }

    const payment = await Payment.findOne({ userId: userId, _id: paymentId });
    if (!payment) {
      const error = new Error("Payment not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      message: "Fetched Payment Successfully",
      payment: payment,
    });
  } catch (err) {
    next(err);
  }
};

exports.refundPayment = async (req, res, next) => {
  const paymentId = req.params.paymentId;
  const userId = req.userId;
  const { amount, reason } = req.body;

  try {
    if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
      const error = new Error("Invalid Payment ID");
      error.statusCode = 400;
      throw error;
    }

    const payment = await Payment.findOne({ _id: paymentId, userId: userId });

    if (!payment) {
      const error = new Error("Payment not found or access denied");
      error.statusCode = 404;
      throw error;
    }

    if (payment.paymentMethod === "cash_on_delivery") {
      const error = new Error("Cannot refund a cash on delivery payment");
      error.statusCode = 400;
      throw error;
    }

    if (payment.status !== "completed") {
      const error = new Error("Cannot refund a payment that is not completed");
      error.statusCode = 400;
      throw error;
    }

    const refundAmount = amount
      ? Math.min(amount, payment.amount)
      : payment.amount;

    const refund = await stripe.refunds.create({
      payment_intent: payment.paymentId,
      amount: refundAmount,
      reason: reason || "requested_by_customer",
    });

    payment.status = "refunded";
    payment.refundDetails = refund;
    await payment.save();

    res.status(200).json({
      message: "Refund processed successfully",
      refund,
    });
  } catch (err) {
    next(err);
  }
};

exports.allPayments = async (req, res, next) => {
  const userId = req.userId;

  try {
    const payments = await Payment.find({ userId: userId });

    if (!payments) {
      const error = new Error("Payments not found or access denied");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      message: "Featched All Payments for the logged in user",
      payments: payments,
    });
  } catch (err) {
    next(err);
  }
};
