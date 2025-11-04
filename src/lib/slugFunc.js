const slugify = require("slugify");

const generateUniqueSlug = async (model, text, count = 0) => {
  const slug = count
    ? `${slugify(text, {
        lower: true,
        remove: /[*+~.()'"!:@#$%^&{}[\]|\\/<>?,]/g,
        strict: true,
        locale: "en",
      })}-${count}`
    : slugify(text, {
        lower: true,
        remove: /[*+~.()'"!:@#$%^&{}[\]|\\/<>?,]/g,
        strict: true,
        locale: "en",
      });
  const exists = await model.findOne({ slug, deletedAt: null });
  if (count > 3) {
   return generateUniqueSlug(model, text, Date.now());
  }
  return exists ? generateUniqueSlug(model, text, count + 1) : slug;
};

module.exports = {
  generateUniqueSlug,
};
