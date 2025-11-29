require("dotenv").config();
const express = require("express");
const { connectDB } = require("./db");
const routes = require("./routes");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use("/api", routes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// Connect to MongoDB then start server
connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Employee analytics backend listening on port ${port}`);
  });
});
