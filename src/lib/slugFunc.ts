import slugify from "slugify";

type SlugModel = {
  findOne(filter: { slug: string; deletedAt: null }): Promise<unknown>;
};

export const generateUniqueSlug = async (
  model: SlugModel,
  text: string,
): Promise<string> => {
  const baseSlug = slugify(text, {
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