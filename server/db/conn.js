const mongoose = require('mongoose');

const url = 'mongodb+srv://realTimeChat_admin:22101@users.slciey1.mongodb.net/?retryWrites=true&w=majority&appName=users';

mongoose.connect(url)
.then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('Error connecting to MongoDB:', err);
});
