const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET);

// middleware
app.use(cors());
app.use(express.json());
const client = new MongoClient(
  `mongodb+srv://${process.env.USER_BUCKET}:${process.env.SECRET_KEY}@cluster0.mnvzcly.mongodb.net/?retryWrites=true&w=majority`,
  {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  }
);

const verifyJWT = (req, res, next) => {
  const token = req.headers.authorization;
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
      if (err) {
        return res
          .status(401)
          .send({ err: true, message: "Unauthorized access" });
      } else {
        req.decoded = decoded;
        next();
      }
    });
  } else {
    return res.status(401).send({ err: true, message: "Unauthorized access" });
  }
};

async function run() {
  try {
    app.get("/", (req, res) =>
      res.send(`Ashta Banjan Restaurants PORT:${port}`)
    );
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("You successfully connected to MongoDB!");

    const userCollection = client
      .db("ashtaBanjanDB")
      .collection("userCollection");

    const menuCollection = client
      .db("ashtaBanjanDB")
      .collection("menuCollection");

    const reviewCollection = client
      .db("ashtaBanjanDB")
      .collection("reviewCollection");

    const cartCollection = client
      .db("ashtaBanjanDB")
      .collection("cartCollection");

    const paymentCollection = client
      .db("ashtaBanjanDB")
      .collection("paymentCollection");

    // JWT
    app.post("/jwt", (req, res) => {
      const data = req.body;
      const token = jwt.sign(data, process.env.ACCESS_TOKEN, {
        expiresIn: "1d",
      });
      res.send({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      const uid = req.decoded.uid;
      const result = await userCollection.findOne({ uid: { $eq: uid } });
      if (result.role !== "admin") {
        res.status(403).send({ err: true, message: "forbidden access" });
      }
      next();
    };

    // ADMIN SECTION =======================
    app.get("/user", verifyJWT, verifyAdmin, async (req, res) => {
      const results = await userCollection.find().toArray();
      res.send(results);
    });

    app.get("/user/admin/:uid", verifyJWT, async (req, res) => {
      const uid = req.params.uid;
      if (uid !== req.decoded.uid) {
        res.send({ err: true, message: "you are not an admin" });
      }
      const result = await userCollection.findOne({ uid: { $eq: uid } });
      res.send(result);
    });

    app.post("/user", async (req, res) => {
      const data = req.body;
      const isExist = await userCollection.findOne({ uid: { $eq: data.uid } });
      if (!isExist) {
        const result = await userCollection.insertOne(data);
        res.send(result);
      }
      res.send({ message: "user exist" });
    });

    app.patch("/user/admin/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: data.role,
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/user/admin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // USERS SECTION =======================
    app.get("/menu", async (req, res) => {
      const results = await menuCollection.find().toArray();
      res.send(results);
    });

    app.post("/menu", verifyJWT, verifyAdmin, async (req, res) => {
      const data = req.body;
      const result = await menuCollection.insertOne(data);
      res.send(result);
    });

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);
    });

    app.patch("/menu/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: data.name,
          price: data.price,
          recipe: data.recipe,
        },
      };
      const result = await menuCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/menu/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/count", async (req, res) => {
      const total = (
        await menuCollection
          .find({ category: { $eq: req.query.category } })
          .toArray()
      ).length;
      res.send({ total });
    });

    app.get("/carts", verifyJWT, async (req, res) => {
      if (req?.query?.uid === req?.decoded?.uid) {
        const results = await cartCollection
          .find({ uid: { $eq: req.query.uid } })
          .toArray();
        res.send(results);
      } else {
        res.status(403).send({ err: true, message: "Forbidden token" });
      }
    });

    app.post("/carts", async (req, res) => {
      const data = req.body;
      const results = await cartCollection.insertOne(data);
      res.send(results);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/category", async (req, res) => {
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 6;
      const skip = page * limit;
      const results = await menuCollection
        .find({ category: { $eq: req.query.category } })
        .skip(skip)
        .limit(limit)
        .toArray();
      res.send(results);
    });

    // GET Review
    app.get("/review", async (req, res) => {
      const results = await reviewCollection.find().toArray();
      res.send(results);
    });

    // PAYMENT
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { chargeAmount } = req.body;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: parseFloat((chargeAmount * 100).toFixed(2)),
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/payment", verifyJWT, async (req, res) => {
      const result = await paymentCollection
        .find({ uid: { $eq: req.query.uid } })
        .toArray();
      res.send(result);
    });

    app.post("/payment", verifyJWT, async (req, res) => {
      const data = req.body;

      const result = await paymentCollection.insertOne(data);
      const query = {
        _id: { $in: data.orderItems.map((e) => new ObjectId(e._id)) },
      };
      await cartCollection.deleteMany(query);
      res.send(result);
    });

    app.get("/admin-stats", verifyJWT, verifyAdmin, async (req, res) => {
      const totalUsers = await userCollection.estimatedDocumentCount();
      const totalRecipes = await menuCollection.estimatedDocumentCount();
      const totalOrder = await paymentCollection.estimatedDocumentCount();
      const revenue = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: "$chargeAmount" },
            },
          },
        ])
        .toArray();
      res.send({ totalUsers, totalRecipes, totalOrder, revenue });
    });

    app.get("/order-stats", verifyJWT, verifyAdmin, async (req, res) => {
      const pipeline = [
        {
          $lookup: {
            from: "menuCollection",
            localField: "orderItems.category",
            foreignField: "category",
            as: "menuItems",
          },
        },
        {
          $unwind: "$orderItems",
        },
        {
          $group: {
            _id: "$orderItems.category",
            totalAmount: { $sum: "$orderItems.price" },
            totalCount: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            category: "$_id",
            totalAmount: 1,
            totalCount: 1,
          },
        },
      ];
      const results = await paymentCollection.aggregate(pipeline).toArray();
      res.send(results);
    });

    app.get("/booking", verifyJWT, verifyAdmin, async (req, res) => {
      const retults = await paymentCollection.find().toArray();
      res.send(retults);
    });

    app.patch("/booking/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: data.status,
        },
      };
      const result = await paymentCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
  } finally {
    app.listen(port, () => console.log("Ashta Banjan Server is running", port));
  }
}
run().catch(console.dir);
