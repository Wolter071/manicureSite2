/** Временно: главная отдаётся статическим файлом public/site.html.
 *  На этапе SEO/i18n страницы будут перенесены в React. */
module.exports = {
  poweredByHeader: false,
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/site.html" }] };
  },
};
