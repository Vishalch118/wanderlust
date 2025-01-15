if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapAsync = require("./Util/wrapAsync.js");
const ExpressError = require("./Util/ExpressError.js");
const { listingSchema, reviewSchema } = require("./schema.js");
const Review = require("./models/review.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");

const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";
const dbUrl = process.env.ATLAS_DB || MONGO_URL; // Fallback to local MongoDB

// Database connection
async function main() {
  try {
    await mongoose.connect(dbUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to DB");
  } catch (err) {
    console.error("Error connecting to DB:", err.message);
    process.exit(1); // Exit the application if the DB connection fails
  }
}

main();

app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// Mongo session store
const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: { secret: process.env.SECRET || "fallbackSecret" }, // Fallback secret
  touchAfter: 24 * 3600, // Update session only once per 24 hours
});

store.on("error", (err) => {
  console.error("Error in Mongo session store:", err);
});

// Session configuration
const sessionOptions = {
  store,
  secret: process.env.SECRET || "fallbackSecret", // Fallback secret
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
};

app.use(session(sessionOptions));
app.use(flash());

// Passport setup
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Middleware to provide flash messages and current user to templates
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

// Routes
app.get("/demouser", async (req, res) => {
  try {
    const fakeUser = new User({
      email: "student@gmail.com",
      username: "delta-Student",
    });
    const newUser = await User.register(fakeUser, "Helloworld");
    res.send(newUser);
  } catch (err) {
    console.error("Error creating demo user:", err);
    res.status(500).send("Error creating demo user");
  }
});

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);

// Handle 404 errors
app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found!"));
});

// Global error handler
app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something went wrong" } = err;
  res.status(statusCode).render("error.ejs", { message });
});

// Start server
app.listen(8080, () => {
  console.log("Server is listening on port 8080");
});

// Example test route (optional)
// app.get("/testListing", async (req, res) => {
//   try {
//     const sampleListing = new Listing({
//       title: "My New Villa",
//       description: "By the beach",
//       price: 1200,
//       location: "Calangute, Goa",
//       country: "India",
//     });
//     await sampleListing.save();
//     console.log("Sample listing saved");
//     res.send("Sample listing created successfully");
//   } catch (err) {
//     console.error("Error creating sample listing:", err);
//     res.status(500).send("Error creating sample listing");
//   }
// });
