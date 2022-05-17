const express = require('express')
const app = express()
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PROT || 5000

app.use(express.json())
app.use(cors())

function verifyJWT(req, res, next) {
    const authorization = req.headers.authorization
    if (!authorization) {
        res.status(401).send({ message: 'UnAuthorized access' })
    }
    const token = authorization.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next()
    })
}

const uri = `mongodb+srv://${process.env.BD_NAME}:${process.env.BD_PASS}@finalproject.4pehg.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
    try {
        await client.connect();
        const Databasae = client.db('Service').collection('Data')
        const bookingceCllection = client.db('clientInfo').collection('Data')
        const userCollection = client.db('UserInfo').collection('Data')

        // getting data from Databasae 
        app.get('/service', async (req, res) => {
            const query = {}
            const cursor = Databasae.find(query);
            const service = await cursor.toArray()
            res.send(service)
        })
        // getting users data from Databasae 
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });

        // getting data from Databasae 
        app.get('/userbooking', verifyJWT, async (req, res) => {
            const useremail = req.query.email;
            const decodedEmail = req.decoded.email;
            if (decodedEmail === useremail) {
                const query = { patient: useremail }
                const cursor = bookingceCllection.find(query);
                const book = await cursor.toArray()
                res.send(book)
            }
            else {
                res.status(403).send({ message: 'Forbidden access' })
            }
        })

        // posting data to the Databasae 
        app.post('/clientDataPost', async (req, res) => {
            const clientData = req.body
            const query = { treatment: clientData.treatment, date: clientData.date, patientName: clientData.patientName }
            const exsist = await bookingceCllection.findOne(query);
            if (exsist) {
                return res.send({ booking: exsist, success: false })
            }
            const result = await bookingceCllection.insertOne(clientData);
            res.send({ result, success: true })
        })

        app.get('/available', async (req, res) => {
            const date = req.query.date;
            // step 1:  get all services
            const services = await Databasae.find().toArray();

            // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}, {}]
            const query = { date: date };
            const bookings = await bookingceCllection.find(query).toArray();

            // step 3: for each service
            services.forEach(service => {
                // step 4: find bookings for that service. output: [{}, {}, {}, {}]
                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                // step 5: select slots for the service Bookings: ['', '', '', '']
                const bookedSlots = serviceBookings.map(book => book.slot);
                // step 6: select those slots that are not in bookedSlots
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                //step 7: set available to slots to make it easier 
                service.slots = available;
            });

            res.send(services);
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
        })

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })
    } finally {
        //   await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello world from doctor portal!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})