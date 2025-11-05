const nodemailer = require("nodemailer");
const path = require("path");
const ejs = require("ejs");
const { promisify } = require("util");

const renderFile = promisify(ejs.renderFile);

// --- Create Gmail transporter ---
const createTransporter = async () => {
  if (!process.env.MY_GMAIL || !process.env.MY_GMAIL_PASSWORD) {
    throw new Error("Missing Gmail credentials in environment variables");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.MY_GMAIL,
      pass: process.env.MY_GMAIL_PASSWORD,
    },
    connectionTimeout: 20000, // 20 seconds
  });

  // Optional: verify connection
  await transporter.verify();
  return transporter;
};

// --- Email templates setup ---
const templates = {
  passwordReset: {
    subject: "Password Reset OTP",
    template: "password-reset-otp.ejs",
  },
  verifyEmail: {
    subject: "Verify Your Email",
    template: "verify-email.ejs",
  },
  contactEmail: {
    subject: `New Contact Form Submission - ${process.env.APP_NAME}`,
    template: "contact-email.ejs",
  },
  orderConfirmed: {
    subject: `Your Order is Confirmed! - ${process.env.APP_NAME}`,
    template: "order-confirmed.ejs",
  },
  paymentFailed: {
    subject: `Payment Failed for Order - ${process.env.APP_NAME}`,
    template: "payment-failed.ejs",
  },
  orderShipped: {
    subject: `Your Order Has Been Shipped! - ${process.env.APP_NAME}`,
    template: "order-shipped.ejs",
  },
  orderDelivered: {
    subject: `Your Order Has Been Delivered! - ${process.env.APP_NAME}`,
    template: "order-delivered.ejs",
  },
  orderCancelled: {
    subject: `Order Cancellation Confirmation - ${process.env.APP_NAME}`,
    template: "order-cancelled.ejs",
  },
  orderDeliveryOTP: {
    subject: `Your Delivery OTP - ${process.env.APP_NAME}`,
    template: "order-delivery-otp.ejs",
  },
};

// --- Render EJS template ---
const renderTemplate = async (templateName, data) => {
  const template = templates[templateName];
  if (!template) throw new Error(`Template ${templateName} not found`);

  const templatePath = path.join(
    __dirname,
    "..",
    "views",
    "emails",
    template.template
  );

  const html = await renderFile(templatePath, {
    ...data,
    year: new Date().getFullYear(),
    appName: process.env.APP_NAME || "Jewellery Walla",
  });

  return { subject: template.subject, html };
};

// --- Send Email ---
const sendEmail = async (to, templateName, data = {}) => {
  try {
    const transporter = await createTransporter();
    const { subject, html } = await renderTemplate(templateName, data);

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || "Jewellery Walla"}" <${
        process.env.MY_GMAIL
      }>`,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent: ${info}`);
    return info;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  templates: Object.keys(templates),
};
