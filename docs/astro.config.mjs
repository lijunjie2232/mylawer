// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: '法律アシスタント',
			tagline: 'インテリジェントな法的コンサルティングアシスタント',
			description: 'LangChain を基盤とした法的コンサルティングシステム。様々な法律問題に回答し、専門的な法的アドバイスを提供できます。',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/your-repo/law_assistant' }
			],
			sidebar: [
				{
					label: 'はじめに',
					items: [
						{ label: '概要', slug: 'index' },
						{ label: 'クイックスタート', slug: 'guides/quickstart' },
						{ label: 'インストール', slug: 'guides/installation' },
					],
				},
				{
					label: '使用ガイド',
					items: [
						{ label: 'CLI モード', slug: 'guides/cli-mode' },
						{ label: 'サーバーモード', slug: 'guides/server-mode' },
						{ label: 'LINE Bot 連携', slug: 'guides/line-bot' },
					],
				},
				{
					label: 'リファレンス',
					autogenerate: { directory: 'reference' },
				},
				{
					label: 'デプロイ',
					items: [
						{ label: 'Docker デプロイ', slug: 'deployment/docker' },
						{ label: '環境設定', slug: 'deployment/environment' },
					],
				},
			],
		}),
	],
});
