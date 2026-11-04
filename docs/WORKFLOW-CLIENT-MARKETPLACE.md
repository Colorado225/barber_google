# Workflow complet — client réservant depuis la marketplace

**Date :** 4 novembre 2026  
**Périmètre :** parcours client marketplace → prise en charge au salon → encaissement → après-service.  
**Méthode :** faits vérifiés par lecture du code/migrations ; les chaînons non branchés sont signalés.

---

## 1. Vue d’ensemble

```text
Client (anonyme)
  │
  ├─ 1. Découvre le salon publié sur la marketplace
  ├─ 2. Choisit prestation + coiffeur + date + créneau réel
  ├─ 3. Réserve → rendez-vous « pending » + jeton d’annulation secret
  │
Salon (ERP)
  ├─ 4. Voit la demande dans le planning / tableau de bord
  ├─ 5. Confirme → « confirmed »
  │
Jour J
  ├─ 6. Accueil → « checked_in »
  ├─ 7. Démarrage prestation → « in_progress »
  ├─ 8. Fin prestation → « completed »
  ├─ 9. Encaissement caisse → payment_status « paid » / « deposit_paid »
  │
Après-service
  ├─ 10. Avis vérifié (si client authentifié + RDV terminé)
  └─ 11. Fidélisation / CRM (partiellement manuel aujourd’hui)
```

---

## 2. Côté client — réservation en ligne

### 2.1 Découverte et fiche publique

- Le client arrive sur la marketplace ou via un lien/QR code `/salons/<slug>`.
- Seuls les salons **publiés** sont visibles (`is_published = true`).
- La fiche publique montre : prestations actives, équipe publique, horaires,
  photos, avis **vérifiés**, localisation, contact WhatsApp.
- RPC : `marketplace_list_salons`, `marketplace_salon_detail`.

### 2.2 Choix du créneau

- Le client choisit :
  - une prestation ;
  - un collaborateur ou « sans préférence » ;
  - une date dans les 60 jours ;
  - un créneau disponible.
- Les disponibilités sont calculées côté serveur via
  `marketplace_day_availability`, en réutilisant les règles internes :
  horaires succursale, horaires/absences staff, anti-chevauchement.
- Créneaux affichés : 08 h → 19 h, fenêtre adaptée à la durée de la prestation.

### 2.3 Réservation

- Le client renseigne : nom, téléphone, e-mail optionnel, notes.
- RPC : `marketplace_book_appointment`.
- Résultat immédiat :
  - `source = 'marketplace'` ;
  - `status = 'pending'` ;
  - `payment_status = 'unpaid'` ;
  - montant = prix de la prestation, en XOF entier ;
  - `public_cancel_token` secret ;
  - `public_idempotency_key` pour éviter les doublons.
- Garde-fous :
  - créneau entre `now + 5 min` et `now + 60 jours` ;
  - max. 5 réservations marketplace / téléphone / salon / jour ;
  - refus si le créneau n’est plus disponible ;
  - rejeu idempotent = même réservation retournée.

### 2.4 Confirmation visuelle côté client

- Le modal affiche :
  - « En attente de confirmation » tant que le salon n’a pas confirmé ;
  - le récapitulatif : prestation, date/heure, coiffeur, montant, référence ;
  - un bouton WhatsApp manuel pour contacter le salon ;
  - un bouton d’annulation tant que la réservation est `pending` ou `confirmed`.

> Limite actuelle : le jeton d’annulation est utilisé dans le modal, mais il
> n’existe pas encore de page client persistante « Mes réservations » permettant
> de retrouver la réservation après fermeture du modal. La RPC
> `marketplace_get_booking` existe, mais n’est pas encore branchée à une page.

---

## 3. Côté salon — validation de la demande

### 3.1 Réception de la demande

- La réservation apparaît dans les rendez-vous du salon :
  - `Planning & RDV` ;
  - `Tableau de bord → Planning du jour`.
- Elle est identifiable par son statut `pending` / « En attente ».
- Aujourd’hui, il n’y a pas encore de badge/filtre dédié « Marketplace » dans le
  planning ; la demande est mélangée aux autres rendez-vous non walk-in.

### 3.2 Confirmation

- Rôles autorisés : `owner`, `manager`, `receptionist` (`appointments.write`).
- Action : passer de `pending` à `confirmed`.
- RPC : `transition_appointment`.
- Effets :
  - le créneau est confirmé ;
  - un événement est journalisé dans `appointment_events` ;
  - une notification `booking_confirmed` est mise en outbox.

### 3.3 Refus / annulation salon

- Le salon peut annuler avec motif.
- RPC : `cancel_appointment` / `transition_appointment`.
- Une notification `booking_cancelled` est mise en outbox.

---

## 4. Jour J — prise en charge physique

### 4.1 Accueil

- Le client arrive au salon.
- La réception marque le rendez-vous comme arrivé :
  - `confirmed → checked_in`.
- Cela peut se faire depuis :
  - le bouton d’avancement du planning ;
  - le sélecteur de statut du tableau de bord.
- Le serveur valide la transition ; une transition invalide est refusée.

### 4.2 Démarrage de la prestation

- Le coiffeur prend le client en charge :
  - `checked_in → in_progress`.
- Le rendez-vous reste lié au coiffeur assigné lors de la réservation, sauf
  réaffectation via les outils de planning.

### 4.3 Fin de la prestation

- Une fois la coupe/prestation terminée :
  - `in_progress → completed`.
- Le rendez-vous devient éligible à un avis vérifié.

### 4.4 Absence du client

- Si le client ne vient pas :
  - `confirmed → no_show`, avec motif obligatoire.
- Le créneau est libéré pour les statistiques/planning, mais l’historique reste.

---

## 5. Encaissement

### 5.1 Principe

- Aucun paiement en ligne n’est exigé à la réservation marketplace.
- Le règlement se fait au salon, via la caisse existante.
- Le paiement est lié au rendez-vous (`appointment_id`).

### 5.2 Moyens de paiement

- Espèces : nécessite une session de caisse ouverte.
- Wave, Orange Money, MTN MoMo, Moov Money, carte :
  - enregistrés avec référence opérateur ;
  - statut `pending` jusqu’à vérification manuelle ;
  - confirmation par un rôle habilité (`payments.record` / responsable).

### 5.3 Effets comptables

- RPC : `record_payment`, `confirm_pending_payment`, `reject_pending_payment`.
- Journal immuable `payments` / `payment_events`.
- `appointments.payment_status` mis à jour atomiquement :
  - `unpaid` ;
  - `deposit_paid` si acompte ;
  - `paid` si total réglé ;
  - `refunded` si remboursement net.

---

## 6. Après-service

### 6.1 Avis vérifié

- Un avis n’est « verified » que s’il est lié à un rendez-vous `completed`.
- RPC : `create_review`.
- Un seul avis vérifié par rendez-vous.
- L’auteur doit être authentifié.
- La marketplace affiche uniquement les avis vérifiés dans la fiche publique.

> Limite actuelle : le modal marketplace n’expose pas encore de formulaire
> d’avis post-prestation. Le client anonyme ne peut pas noter directement sans
> compte/authentification.

### 6.2 CRM / fidélité

- Aujourd’hui, une réservation marketplace ne crée pas automatiquement une fiche
  client CRM (`client_id` reste nul).
- La fidélité avancée est prévue dans les lots suivants ; elle n’est pas encore
  automatiquement créditée sur les rendez-vous marketplace.

---

## 7. Notifications

### 7.1 Ce qui est déclenché

Le trigger `appointments_enqueue_notifications` met en file :

| Événement             | Canal                                             | Kind                |
| --------------------- | ------------------------------------------------- | ------------------- |
| Réservation créée     | e-mail + WhatsApp                                 | `booking_received`  |
| Réservation confirmée | e-mail + WhatsApp                                 | `booking_confirmed` |
| Réservation annulée   | e-mail + WhatsApp                                 | `booking_cancelled` |
| Rappel 24 h           | e-mail uniquement, si RDV > 24 h et e-mail fourni | `reminder_24h`      |

### 7.2 Ce qui n’est pas encore branché

- Aucun envoi réel e-mail/WhatsApp/SMS.
- Les lignes restent `pending` dans `appointment_notifications`.
- Il n’y a pas encore d’interface ERP de suivi de l’outbox.
- Le bouton WhatsApp côté client est un lien manuel, pas une notification
  automatique.

---

## 8. Annulation

### 8.1 Côté client

- Possible tant que le statut est `pending` ou `confirmed`.
- RPC : `marketplace_cancel_booking`, avec jeton secret.
- Après `checked_in` / `in_progress`, le client ne peut plus annuler en ligne ;
  le salon doit gérer l’annulation.

### 8.2 Côté salon

- Annulation possible avec motif sur les statuts actifs.
- Historique conservé.
- Notification `booking_cancelled` mise en outbox.

---

## 9. Machine à états

```text
pending
  ├─ confirmed
  └─ cancelled

confirmed
  ├─ checked_in
  ├─ cancelled
  └─ no_show

checked_in
  ├─ in_progress
  └─ cancelled

in_progress
  ├─ completed
  └─ cancelled

completed / cancelled / no_show = états finaux
```

---

## 10. Rôles impliqués

| Action                                                   | Rôles                        |
| -------------------------------------------------------- | ---------------------------- |
| Réserver en ligne                                        | Client anonyme, sans compte  |
| Confirmer / accueil / démarrage / fin / annulation salon | owner, manager, receptionist |
| Encaisser                                                | owner, manager, cashier      |
| Confirmer un paiement Mobile Money                       | rôle habilité caisse         |
| Modérer les avis                                         | owner, manager               |

---

## 11. Chaînons manquants pour un parcours 100 % fluide

> **Mise à jour du 4 novembre 2026** : les points 1 à 6 ci-dessous sont
> désormais **implémentés et appliqués**. Voir `docs/PARCOURS-CLIENT-COMPLET.md`
> pour le détail, les invariants et les vérifications. Seul le point 7 reste
> ouvert, ainsi que l'activation des clés fournisseur d'envoi.

1. ✅ **Page client persistante** : lien secret « Ma réservation » pour retrouver,
   suivre et annuler après fermeture du modal → `/reservation/<jeton>`.
2. ✅ **Envoi réel des notifications** : edge function + cron déployés ; e-mail
   (Resend) et WhatsApp (Cloud API) câblés. **[À activer]** : clés fournisseur.
   SMS non implémenté.
3. ✅ **Inbox ERP marketplace** : onglet « Demandes en ligne » avec badge et
   compteur des réservations `pending`, filtre « En ligne » dans le planning.
4. ✅ **CRM automatique** : création/liaison d’une fiche client à partir du
   téléphone normalisé, sans doublon (verrou de transaction).
5. ✅ **Avis post-prestation** : invitation différée après `completed`, avis
   `verified` rattaché au rendez-vous, un seul par prestation.
6. ✅ **Fidélité automatique** : points sur rendez-vous terminé **et** payé,
   journal append-only, reprise sur remboursement.
7. ❌ **Temps réel multi-postes** : synchronisation instantanée planning/caisse.

---

## 12. Résumé opérationnel pour le salon

1. Le client réserve en ligne → demande `pending`.
2. Le salon confirme dans l’ERP → `confirmed`.
3. Le jour J, le salon marque l’arrivée → `checked_in`.
4. Le coiffeur démarre → `in_progress`.
5. Le coiffeur termine → `completed`.
6. La caisse encaisse → `paid` ou `deposit_paid`.
7. Le client peut laisser un avis vérifié s’il est authentifié.
8. Les notifications sont préparées, mais l’envoi réel reste à brancher.
