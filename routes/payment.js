const express = require("express");
const { body } = require("express-validator");

const paymentController = require("../controllers/payment");
const isAuth = require('../middlewares/is-auth');

const router = express.Router();

router.post("/createIntent", isAuth, paymentController.paymentIntent);

router.post("/confirm", isAuth, paymentController.confirmPayment)

router.put("/updateStatus", isAuth, paymentController.updatePaymentStatus)

router.get("/status/:paymentId", isAuth, paymentController.paymentStatus) 

router.post("/refund/:paymentId", isAuth, paymentController.refundPayment) 

router.get("/payments", isAuth, paymentController.allPayments) 

module.exports = router;
