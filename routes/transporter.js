const nodemailer = require("nodemailer");

// Create a transporter
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "kasamrohithreddy2004@gmail.com", // Your email address
    pass: "xpjgmybkhohvnhzj", // Your email password or app-specific password
  },
});

// Export the transporter to use it in other files
module.exports = transporter;
