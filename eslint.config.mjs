import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // Désactivé : les apostrophes dans le texte français sont volontaires
      // Alternative propre : utiliser &apos; dans chaque composant si nécessaire
      "react/no-unescaped-entities": "off",
      // Warnings uniquement pour img — on migrera vers next/image progressivement
      "@next/next/no-img-element": "warn",
    },
  },
];

export default eslintConfig;
