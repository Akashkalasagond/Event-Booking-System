const express = require("express");
const router = express.Router();
const transporter = require("../routes/transporter"); // Import the nodemailer transporter

router.post("/send_email", (req, res) => {
  const recipientEmail = req.body.recipientEmail;
  const pdfData = req.body.pdfData;

  // Email content
  const mailOptions = {
    from: "kasamrohithreddy2004@gmail.com", // Your email address
    to: recipientEmail,
    subject: "Event Ticket",
    text: "Please find your event ticket attached.",
    attachments: [
      {
        filename: "EventTicket.pdf",
        content: pdfData,
        encoding: "base64",
      },
    ],
  };

  // Send email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
      res.status(500).send("Error sending email");
    } else {
      console.log("Email sent:", info.response);
      res.status(200).send("Email sent successfully");
    }
  });
});

module.exports = router;
