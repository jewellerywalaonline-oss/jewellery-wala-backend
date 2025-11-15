const slugify = require("slugify");

const generateUniqueSlug = async (model, text) => {
  let baseSlug = slugify(text, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@#$%^&{}[\]|\\/<>?,]/g,
    locale: "en",
  });

  let slug = baseSlug;
  let counter = 1;

  while (await model.findOne({ slug, deletedAt: null })) {
    slug = `${baseSlug}-${counter++}`;
  }

  return slug;
};

module.exports = { generateUniqueSlug };
