// const mongoose = require("mongoose");

// const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGODB_URI);
//     console.log("MongoDB connected");
//   } catch (error) {
//     console.error("MongoDB error:", error.message);
//     process.exit(1);
//   }
// };

// module.exports = connectDB;

const mongoose = require('mongoose')

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return
  }

  if (mongoose.connection.readyState === 2) {
    return
  }

  await mongoose.connect(
    process.env.MONGODB_URI,
    {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      maxPoolSize: 10,
      minPoolSize: 1
    }
  )

  console.log(
    'MongoDB Connected:',
    mongoose.connection.host
  )
}

module.exports = connectDB