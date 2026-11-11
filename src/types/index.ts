// Point d'entrée des types métier — fichier d'exports commun de transition.
// Les consommateurs continuent d'importer depuis 'types' ; les définitions
// vivent désormais dans un fichier par domaine.

export * from './salon';
export * from './appointments';
export * from './clients';
export * from './finance';
export * from './stock';
export * from './loyalty';
export * from './notifications';
export * from './marketplace';
export * from './saas';
export * from './erp';
