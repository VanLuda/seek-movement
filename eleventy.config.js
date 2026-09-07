export default function (eleventyConfig) {
  // Static assets copied as-is
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });

  // The custom-domain file is only written by CI when CUSTOM_DOMAIN is set.
  if (process.env.CUSTOM_DOMAIN) {
    eleventyConfig.addGlobalData("customDomain", process.env.CUSTOM_DOMAIN);
  }

  eleventyConfig.addFilter("year", () => new Date().getFullYear());

  // Nunjucks: allow {{ site.somethingHtml | safe }} etc.
  eleventyConfig.setNunjucksEnvironmentOptions({ autoescape: true });

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    // "/" on the custom domain, "/seek-movement/" while previewing on github.io
    pathPrefix: process.env.PATH_PREFIX || "/",
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
