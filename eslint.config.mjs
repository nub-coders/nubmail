import nextVitals from 'eslint-config-next/core-web-vitals';

export default [
	...nextVitals,
	{
		rules: {
			'@next/next/no-html-link-for-pages': 'off',
			'react-hooks/purity': 'off',
			'react/no-unescaped-entities': 'off',
			'react-hooks/set-state-in-effect': 'off',
		},
	},
];