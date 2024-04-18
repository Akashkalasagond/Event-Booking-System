const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");
const session = require("express-session");
const passport = require("passport"); // Import passport
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const bcrypt = require("bcrypt");
const Razorpay = require("razorpay");
const emailRoute = require("./routes/emailRoute");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "views"))); // Serve static files from the 'views' directory
// Set the views directory and view engine
app.set("views", path.join(__dirname, "views"));
app.use(express.static("views"));
app.set("view engine", "ejs");

// Setup session middleware
app.use(
  session({
    secret: "secret", // Change this to a random secret key
    resave: false,
    saveUninitialized: true,
  })
);

// Initialize passport middleware
app.use(passport.initialize());
app.use(passport.session()); // Use passport with sessions

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/signupDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// Define mongoose schema for user
const userSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true,
    required: true,
    match: /^\S+@\S+\.\S+$/,
  },
  password: {
    type: String,
    required: false,
    minlength: 6,
  },
  role: {
    type: String,
    default: "user",
  },
});
const eventSchema = new mongoose.Schema({
  eventName: String,
  eventDescription: String,
  eventType: String,
  capacity: Number,
  startDateTime: Date,
  endDateTime: Date,
  ticketPrice: Number,
  venueDetails: String,
  eventImage: String,
});

// Define the schema for the booking details
const bookingSchema = new mongoose.Schema({
  eventName: String,
  eventPrice: Number,
  quantity: Number,
  paymentId: String,
  orderId: String,
  // Add other fields as needed
});

// Create a model using the schema
const Booking = mongoose.model("Booking", bookingSchema);

// Hash password before saving
userSchema.pre("save", async function (next) {
  const user = this;
  if (!user.isModified("password")) return next();

  try {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    user.password = hashedPassword;
    next();
  } catch (error) {
    return next(error);
  }
});
const Event = mongoose.model("Event", eventSchema);

module.exports = Event;

const User = mongoose.model("User", userSchema);
// Serialize user into session
passport.serializeUser(function (user, done) {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async function (id, done) {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

const GOOGLE_CLIENT_ID =
  "546288921587-51iu41glj5hc748t0egkpm51ntsg2012.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = "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";
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback",
    },
    async function (accessToken, refreshToken, profile, done) {
      try {
        // Check if the user already exists in the database
        let user = await User.findOne({ email: profile.emails[0].value });

        // If user does not exist, create a new user
        if (!user) {
          user = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            role: "user", // Set role to "user"
          });

          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);
//
// Initialize Razorpay instance with your API key and secret
const razorpay = new Razorpay({
  key_id: "rzp_test_9WuLEKT1yvT5zO",
  key_secret: "EPUd7mLZmg8Zn02CraZnJtjG",
});

app.post("/create_order", async (req, res) => {
  try {
    const { eventName, eventPrice, quantity } = req.body;

    const totalPrice = eventPrice * quantity;

    const order = await razorpay.orders.create({
      amount: totalPrice * 100,
      currency: "INR",
      receipt: "receipt_order_123",
      payment_capture: 1,
    });

    res.json({ id: order.id, amount: totalPrice * 100 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/save_booking", async (req, res) => {
  try {
    const {
      eventName,
      eventDescription,
      eventType,
      capacity,
      startDateTime,
      endDateTime,
      ticketPrice,
      venueDetails,
      eventImage,
      quantity,
      paymentId,
      orderId,
    } = req.body;

    const newBooking = new Booking({
      eventName,
      eventDescription,
      eventType,
      capacity,
      startDateTime,
      endDateTime,
      ticketPrice,
      venueDetails,
      eventImage,
      quantity,
      paymentId,
      orderId,
    });

    await newBooking.save();

    res.status(200).send({ message: "Booking saved successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//email route

app.use("/", emailRoute);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect to userdashboard.html or userdashboard route
    res.redirect("/userdashboard");
  }
); // Route to handle signup
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if all required fields are provided
    if (!name || !email) {
      return res.status(400).send({ message: "Name and email are required." });
    }

    // Create a new user instance
    const newUser = new User({
      name,
      email,
      password: password || generateRandomPassword(), // Assign the provided password or generate a random one
    });

    // Save the user to the database
    await newUser.save();

    res.status(200).send({ message: "Signup successful." });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal server error." });
  }
});

// Function to generate a random password
function generateRandomPassword() {
  // Generate a random string of characters
  const randomString = Math.random().toString(36).slice(-8);
  return randomString;
}
app.get("/signup", (req, res) => {
  res.render("signup"); // Render the signup.ejs view
});

app.get("/fetch", (req, res) => {
  res.render("fetch"); // Render the signup.ejs view
});
app.get("/login", (req, res) => {
  res.render("login");
});
// Route to render your EJS template
app.get("/About", (req, res) => {
  // Assuming you have imagePath1, imagePath2, and imagePath3 set appropriately
  res.render("About", {
    imagePath1: "1.jpg",
    imagePath2: "2.jpeg",
    imagePath3: "3.jpeg",
  });
});
app.get("/About", (req, res) => {
  res.render("About");
});
app.get("/userdashboard", (req, res) => {
  res.render("userdashboard"); // Render the fetch.ejs view
});

app.get("/userdashboard", (req, res) => {
  res.render("userdashboard"); // Render the boooking.ejs view
});
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).send({ message: "Invalid email or password." });
    }

    // Compare the provided password with the hashed password stored in the database
    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).send({ message: "Invalid email or password." });
    }

    // If password matches, set the user object in the session
    req.session.user = user;

    res.status(200).send({ message: "Login successful.", role: user.role });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal server error." });
  }
});

app.get("/dashboard", requireAdmin, (req, res) => {
  res.render("dashboard");
});

function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") {
    next();
  } else {
    res
      .status(403)
      .send("Only admin users are allowed to access this resource.");
  }
}
app.get("/userdashboard", requireUser, (req, res) => {
  res.render("userdashboard");
});

function requireUser(req, res, next) {
  if ((req.session.user && req.session.user.role === "user") || req.user) {
    next();
  } else {
    res.status(403).send("Only users are allowed to access this resource.");
  }
}

app.post("/save-event", async (req, res) => {
  try {
    const {
      eventName,
      eventDescription,
      eventType,
      capacity,
      startDateTime,
      endDateTime,
      ticketPrice,
      venueDetails,
      eventImage,
    } = req.body;

    const newEvent = new Event({
      eventName,
      eventDescription,
      eventType,
      capacity,
      startDateTime,
      endDateTime,
      ticketPrice,
      venueDetails,
      eventImage,
    });

    await newEvent.save();

    res.status(200).send({ message: "Event saved successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal server error." });
  }
});

app.get("/booking", requireUser, (req, res) => {
  res.render("booking");
});
// Route handler to fetch events
app.get("/events", async (req, res) => {
  try {
    // Query the MongoDB collection to fetch all events
    const events = await Event.find({});
    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
// Google OAuth callback route
app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  async function (req, res) {
    try {
      // Check if the user already exists in the database
      let user = await User.findOne({ email: req.user.email });

      // If user does not exist, create a new user
      if (!user) {
        // Generate a random password
        const randomPassword = Math.random().toString(36).slice(-8); // Generate 8-character random password

        // Hash the password
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        user = new User({
          name: req.user.displayName,
          email: req.user.email,
          password: hashedPassword, // Save the hashed password
          role: "user", // Set default role
        });

        await user.save();

        // Optionally, you can send the random password to the user's email for future reference
        // SendEmailWithPassword(req.user.email, randomPassword); // Implement this function to send an email with the password
      }

      res.redirect("/userdashboard");
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Internal server error." });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
