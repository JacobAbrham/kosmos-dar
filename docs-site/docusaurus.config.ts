import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// KOSMOS V2.0 Documentation Configuration
const config: Config = {
  title: 'KOSMOS V2.0',
  tagline: 'AI-Native Enterprise Operating System',
  favicon: 'img/favicon.ico',

  // Future flags for Docusaurus v4 compatibility
  future: {
    v4: true,
  },

  // Production URL - Cloudflare Pages deployment
  url: 'https://docs.nuvanta-holding.com',
  baseUrl: '/',

  // GitHub deployment config (for edit links)
  organizationName: 'nuvanta-holding',
  projectName: 'kosmos-dar',

  // Link checking (set to 'throw' once all pages are generated)
  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  // Internationalization
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Edit links to GitHub repo
          editUrl: 'https://github.com/nuvanta-holding/kosmos-dar/tree/main/docs-site/',
          // Show last update time (enable when git is initialized)
          showLastUpdateTime: false,
          showLastUpdateAuthor: false,
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl: 'https://github.com/nuvanta-holding/kosmos-dar/tree/main/docs-site/',
          blogTitle: 'KOSMOS Updates',
          blogDescription: 'Release notes and updates for KOSMOS V2.0',
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
        // Generate sitemap for SEO
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: ['/tags/**'],
          filename: 'sitemap.xml',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Social card for sharing
    image: 'img/kosmos-social-card.jpg',

    // Respect system dark/light mode preference
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },

    // Announcement bar (optional - for important announcements)
    announcementBar: {
      id: 'documentation_wip',
      content: 'Documentation is being auto-generated from code. Some sections may be under construction.',
      backgroundColor: '#4f46e5',
      textColor: '#ffffff',
      isCloseable: true,
    },

    // Navigation bar
    navbar: {
      title: 'KOSMOS V2.0',
      logo: {
        alt: 'KOSMOS Logo',
        src: 'img/logo.svg',
      },
      items: [
        // Getting Started
        {
          type: 'docSidebar',
          sidebarId: 'gettingStartedSidebar',
          position: 'left',
          label: 'Getting Started',
        },
        // Architecture
        {
          type: 'docSidebar',
          sidebarId: 'architectureSidebar',
          position: 'left',
          label: 'Architecture',
        },
        // Agents
        {
          type: 'docSidebar',
          sidebarId: 'agentsSidebar',
          position: 'left',
          label: 'Agents',
        },
        // API Reference
        {
          type: 'docSidebar',
          sidebarId: 'apiSidebar',
          position: 'left',
          label: 'API',
        },
        // MCP Servers
        {
          type: 'docSidebar',
          sidebarId: 'mcpSidebar',
          position: 'left',
          label: 'MCP Servers',
        },
        // Release Notes / Blog
        {to: '/blog', label: 'Updates', position: 'left'},
        // GitHub link
        {
          href: 'https://github.com/nuvanta-holding/kosmos-dar',
          label: 'GitHub',
          position: 'right',
        },
        // Search (will be configured with Typesense later)
      ],
    },

    // Footer
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/01-getting-started/',
            },
            {
              label: 'Architecture',
              to: '/docs/02-architecture/',
            },
            {
              label: 'API Reference',
              to: '/docs/04-api/',
            },
          ],
        },
        {
          title: 'Agents',
          items: [
            {
              label: 'Zeus (Orchestrator)',
              to: '/docs/agents/zeus',
            },
            {
              label: 'AEGIS (Security)',
              to: '/docs/agents/aegis',
            },
            {
              label: 'All 11 Agents',
              to: '/docs/agents/',
            },
          ],
        },
        {
          title: 'Resources',
          items: [
            {
              label: 'MCP Servers (88)',
              to: '/docs/05-mcp-servers/',
            },
            {
              label: 'Configuration',
              to: '/docs/08-configuration/',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/nuvanta-holding/kosmos-dar',
            },
          ],
        },
        {
          title: 'Company',
          items: [
            {
              label: 'Nuvanta Holding',
              href: 'https://nuvanta-holding.com',
            },
            {
              label: 'Updates',
              to: '/blog',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Nuvanta Holding. All Rights Reserved. Built with Docusaurus.`,
    },

    // Code syntax highlighting
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      // Additional languages for syntax highlighting
      additionalLanguages: ['python', 'bash', 'yaml', 'json', 'typescript', 'sql'],
    },

    // Table of contents settings
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
    },

    // Docs settings
    docs: {
      sidebar: {
        hideable: true,
        autoCollapseCategories: true,
      },
    },
  } satisfies Preset.ThemeConfig,

  // Additional plugins can be added here
  plugins: [],

  // Typesense Search Configuration
  // Enable when TYPESENSE_HOST environment variable is set
  ...(process.env.TYPESENSE_HOST ? {
    themes: ['@docusaurus/theme-mermaid', 'docusaurus-theme-search-typesense'],
    themeConfig: {
      typesense: {
        typesenseCollectionName: 'kosmos-docs',
        typesenseServerConfig: {
          nodes: [{
            host: process.env.TYPESENSE_HOST,
            port: parseInt(process.env.TYPESENSE_PORT || '443'),
            protocol: process.env.TYPESENSE_PROTOCOL || 'https',
          }],
          apiKey: process.env.TYPESENSE_SEARCH_API_KEY || '',
        },
        typesenseSearchParameters: {
          query_by: 'content,title,description',
          num_typos: 2,
        },
        contextualSearch: true,
      },
    },
  } : {}),

  // Markdown configuration
  markdown: {
    mermaid: true,
  },

  // Enable Mermaid for diagrams
  themes: ['@docusaurus/theme-mermaid'],
};

export default config;
