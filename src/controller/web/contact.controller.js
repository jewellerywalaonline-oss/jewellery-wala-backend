const { sendEmail } = require("../../lib/nodemailer");

exports.contact = async (req, res) => {
  try {
    // Input validation

    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        _status: false,
        _message: "All fields are required",
      });
    }

    // Send email
    await sendEmail(
      process.env.MY_GMAIL,
      "contactEmail",
      {
        name,
        email,
        message,
        subject: `New Contact Form Submission from ${name}`,
        replyTo: email,
      }
    );

    return res.status(200).json({
      _status: true,
      _message: "Thank you for contacting us! We will get back to you soon.",
    });
  } catch (error) {
    console.error("Contact form error:", error);
    return res.status(500).json({
      _status: false,
      _message: "An error occurred while processing your request",
      _error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
