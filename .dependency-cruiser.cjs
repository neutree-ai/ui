/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-L1-import-L2-L3",
      comment: "L1 foundation must not import from L2 domains or L3 pages",
      severity: "error",
      from: { path: "^src/foundation/" },
      to: { path: "^src/(domains|pages)/" },
    },
    {
      name: "no-L2-import-L3",
      comment: "L2 domains must not import from L3 pages",
      severity: "error",
      from: { path: "^src/domains/" },
      to: { path: "^src/pages/" },
    },
    {
      name: "no-L2-cross-domain",
      comment: "L2 domains must not import from other L2 domains",
      severity: "error",
      from: { path: "^src/domains/([^/]+)/" },
      to: { path: "^src/domains/([^/]+)/", pathNot: "^src/domains/$1/" },
    },
    {
      name: "no-L3-cross-page",
      comment: "L3 pages must not import from other L3 pages",
      severity: "error",
      from: { path: "^src/pages/([^/]+)/" },
      to: { path: "^src/pages/([^/]+)/", pathNot: "^src/pages/$1/" },
    },
    {
      name: "no-L0-import-L2-L3",
      comment: "L0 components/ui must not import from L2 domains or L3 pages",
      severity: "error",
      from: { path: "^src/components/ui/" },
      to: { path: "^src/(domains|pages)/" },
    },
  ],
  options: {
    tsConfig: {
      fileName: "tsconfig.json",
    },
    tsPreCompilationDeps: true,
    includeOnly: "^src/",
  },
};
