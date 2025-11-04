const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users', 
        required: true,
        unique: true ,
        index: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'products', 
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            default: 1,
            min: 1
        },
        color: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'colors', 
            required: true
        },
       
    }],
}, { timestamps: true });


cartSchema.index({ user: 1 });


const Cart = mongoose.model('carts', cartSchema);
module.exports = Cart;
