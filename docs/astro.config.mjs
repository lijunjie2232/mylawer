// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Law Assistant',
			tagline: 'Intelligent legal consulting assistant',
			description: 'A legal consulting system based on LangChain. It can answer various legal questions and provide professional legal advice.',
			defaultLocale: 'ja',
			locales: {
				ja: {
					label: '日本語',
					lang: 'ja',
				},
				en: {
					label: 'English',
					lang: 'en',
				},
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/lijunjie2232/mylawer' }
			],
			sidebar: [
				{
					label: 'Welcome',
					translations: {
						ja: 'はじめに'
					},
					items: [
						{ label: 'Overview', slug: 'index', translations: { ja: '概要' } },
					],
				},
				{
					label: 'Getting Started',
					translations: {
						ja: 'スタートガイド'
					},
					items: [
						{ label: 'Quick Start', slug: 'getting-started/quickstart', translations: { ja: 'クイックスタート' } },
						{ label: 'Installation', slug: 'getting-started/installation', translations: { ja: 'インストールガイド' } },
					],
				},
				{
					label: 'Architecture',
					translations: {
						ja: 'アーキテクチャ'
					},
					items: [
						{ label: 'System Overview', slug: 'concepts/overview', translations: { ja: 'システム概要' } },
						{ label: 'MCP Tool System', slug: 'concepts/mcp-tools', translations: { ja: 'MCPツールシステム' } },
					],
				},
				{
					label: 'Interfaces',
					translations: {
						ja: 'インターフェース'
					},
					items: [
						{ label: 'Web UI', slug: 'guides/web-ui', translations: { ja: 'ウェブ UI' } },
						{ label: 'CLI Mode', slug: 'guides/cli', translations: { ja: 'CLI モード' } },
						{ label: 'LINE Bot Integration', slug: 'guides/line-bot', translations: { ja: 'LINE Bot 連携' } },
					],
				},
				{
					label: 'Configuration',
					translations: {
						ja: '設定'
					},
					items: [
						{ label: 'LLM Providers', slug: 'config/llm', translations: { ja: 'LLM プロバイダー' } },
						{ label: 'Environment Variables', slug: 'config/environment', translations: { ja: '環境変数' } },
						{ label: 'Tool Management', slug: 'config/tools', translations: { ja: 'ツール管理' } },
					],
				},
				{
					label: 'Deployment',
					translations: {
						ja: 'デプロイ'
					},
					items: [
						{ label: 'Docker Deployment', slug: 'deployment/docker', translations: { ja: 'Docker デプロイ' } },
						{ label: 'Security & Auth', slug: 'deployment/security', translations: { ja: 'セキュリティと認証' } },
					],
				},
				{
					label: 'Reference',
					translations: {
						ja: 'リファレンス'
					},
					autogenerate: { directory: 'reference' },
				},
			],
		}),
	],
	site: 'https://lijunjie2232.github.io',
	base: '/mylawer/',
	trailingSlash: "always"
});
