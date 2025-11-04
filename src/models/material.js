const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema({
  name: {
    type : String,
    required : [true , "Please Enter A Name"],
    minlenght : 3 ,
    maxlenght : 20 ,
    match :  /^[a-zA-Z 0-9 ]+$/,
    validate: {
      validator: async function (name) {
        const existingColor = await this.constructor.findOne({ name , deletedAt : null });
        return !existingColor;
      } ,
      message: "Name already exists"

    }
  },
  status : {
    type : Boolean,
    default : true
  },
  order:{
    type : Number,
    default : 0,
    min : 0,
    max : 1000,
    match: /^[0-9]+$/
  },

  deletedAt : {
    type : Date,
    default : null
  }


},{timestamps : true});

const materialModal = mongoose.model("materials", materialSchema);

module.exports = materialModal