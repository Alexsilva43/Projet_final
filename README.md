# Documentation du Smart Contract d'Escrow pour la Vente d'un Véhicule

# 1. Introduction

## 1.1 Objectif du contrat

Ce smart contract implémente un mécanisme d'escrow destiné à sécuriser la vente d'un véhicule entre deux particuliers. Son objectif est de garantir que chaque étape de la transaction soit réalisée dans le bon ordre et que chacune des parties soit protégée contre un comportement malveillant ou une absence de coopération de l'autre partie.

Le smart contract coordonne simultanément trois composantes de la transaction :

- le paiement du véhicule au moyen d'un token **ERC-20** ;
- la représentation numérique de la propriété du véhicule au moyen d'un **NFT ERC-721** ;
- les différentes étapes de la remise physique du véhicule, validées par un intermédiaire certifié.

Le contrat agit comme un tiers de confiance automatisé pour la gestion des actifs numériques, tandis qu'un intermédiaire certifié intervient pour toutes les opérations nécessitant une vérification physique.

L'ensemble du processus est piloté par une machine à états (state machine) qui interdit toute action réalisée dans un ordre incorrect. Chaque transition entre les différents états du contrat correspond à une étape précise de la vente.

---

## 1.2 Participants

Le protocole met en jeu trois acteurs possédant chacun un rôle clairement défini.

### Le vendeur

Le vendeur est le propriétaire du véhicule.

Il est responsable de :

* déposer le NFT représentant le véhicule dans l'escrow ;
* déposer physiquement le véhicule auprès de l'intermédiaire ;
* payer les frais de dépôt du véhicule.
* générer et transmettre le code de cession à l'acheteur sous forme chiffrée ;
* demander une vérification du code de cession lorsqu'un litige survient ;
* récupérer le véhicule en cas d'annulation de la vente.

Le vendeur ne peut jamais récupérer les fonds du véhicule avant que le contrat n'ait validé l'ensemble du processus.

---

### L'acheteur

L'acheteur est responsable de :

* déposer le montant correspondant au prix du véhicule ;
* déposer les frais de vérification lors du financement initial de l'escrow. 
* confirmer ou rejeter le code de cession fourni par le vendeur ;
* demander la récupération physique du véhicule une fois la vente validée ;
* payer les frais de remise du véhicule.

Les frais de vérifiction sont provisoirement bloqués dans le contrat et seront soit remboursés à l'acheteur, soit utilisés pour rémunérer l'intermédiaire en cas de litige, selon l'issue de la transaction ;

L'acheteur dispose d'un délai limité pour confirmer le code de cession. En cas d'absence de réponse ou de contestation, des mécanismes spécifiques sont prévus afin d'éviter le blocage définitif de la transaction.

---

### L'intermédiaire certifié

L'intermédiaire est un professionnel ou un organisme habilité chargé de superviser les opérations physiques.

Ses responsabilités sont notamment :

* confirmer la réception physique du véhicule ;
* remettre le véhicule à l'acheteur une fois la vente terminée ;
* vérifier le code de cession en présence du vendeur lorsqu'un litige apparaît ;
* confirmer la récupération du véhicule par le vendeur lorsque la vente est annulée.

Contrairement aux deux autres participants, l'intermédiaire est considéré comme un tiers de confiance.

Le contrat suppose que toutes les opérations effectuées par l'intermédiaire sont réalisées lors d'un rendez-vous physique, en présence du vendeur ou de l'acheteur.

Cette hypothèse de confiance est fondamentale dans la conception du protocole.

---

## 1.3 Hypothèses de confiance

Le contrat protège les participants contre :

* l'absence de dépôt des fonds ;
* l'absence de dépôt du NFT ;
* l'absence de transmission du code de cession ;
* l'absence de confirmation du code de cession ;
* l'envoi d'un code de cession incorrect.

En revanche, le contrat considère que l'intermédiaire est un acteur fiable et certifié.

Lorsqu'une demande de vérification est effectuée, le smart contract attend simplement la décision de l'intermédiaire sans imposer de délai maximal.

Ce choix est volontaire.

En effet, le protocole repose sur l'hypothèse que l'intermédiaire est un tiers de confiance certifié, chargé de superviser l'ensemble des opérations physiques liées à la vente.

Les opérations suivantes doivent obligatoirement être réalisées en présence des participants concernés :

- le dépôt physique du véhicule, en présence du vendeur ;
- la remise du véhicule à l'acheteur, en présence de ce dernier ;
- la récupération du véhicule par le vendeur lorsque la vente est annulée ;
- la vérification du code de cession en présence du vendeur lorsqu'un litige apparaît.

Une fois que l'une de ces procédures est engagée, le smart contract considère que son déroulement est entièrement pris en charge par l'intermédiaire.

Pour cette raison, le contrat ne prévoit aucun délai spécifique pour les actions réalisées par l'intermédiaire. Contrairement au vendeur et à l'acheteur, dont l'inaction peut être gérée par des mécanismes de délai et d'annulation, l'intermédiaire est considéré comme un acteur de confiance dont les interventions s'inscrivent dans le cadre normal de la procédure de vente.

---

# 2. Description des frais

Le protocole manipule quatre flux financiers distincts.

Chacun de ces frais possède un objectif précis et est traité indépendamment des autres.

---

## 2.1 Prix du véhicule

Le prix du véhicule correspond au montant de la vente.

Il est déposé par l'acheteur au début de la procédure et reste entièrement bloqué dans le contrat jusqu'à la résolution définitive de la transaction.

Deux situations sont possibles :

* la vente est validée : le vendeur reçoit le prix du véhicule ;
* la vente est annulée : l'acheteur récupère intégralement ce montant.

Le contrat garantit que ces fonds ne peuvent jamais être transférés à une mauvaise personne.

---

## 2.2 Frais de dépôt du véhicule

Avant que le véhicule ne soit physiquement confié à l'intermédiaire, le vendeur doit payer des frais de dépôt.

Ces frais rémunèrent le travail réalisé par l'intermédiaire lors de :

* la réception du véhicule ;
* la vérification de son dépôt.

Dès que l'intermédiaire confirme la réception physique du véhicule, ces frais lui sont immédiatement transférés.

Ils ne sont jamais remboursés puisque le service correspondant a déjà été réalisé.

---

## 2.3 Frais de récupération du véhicule

Les frais de récupération rémunèrent l'intervention de l'intermédiaire lors de la remise physique du véhicule.

Ils sont payés :

* par l'acheteur lorsque la vente est finalisée ;
* par le vendeur lorsque la vente est annulée et que celui-ci doit récupérer son véhicule.

Ces frais ne sont transférés à l'intermédiaire qu'après confirmation effective de la remise du véhicule.

Ils rémunèrent donc exclusivement une prestation réellement effectuée.

---

## 2.4 Frais de vérification

Les frais de vérification constituent un mécanisme permettant de rémunérer l'intermédiaire lorsqu'un litige relatif au code de cession apparaît.

Le fonctionnement est volontairement conçu afin que la partie responsable du litige supporte finalement le coût de cette vérification.

### Dépôt initial

Lors du financement de l'escrow, l'acheteur dépose :

* le prix du véhicule ;
* une première fois les frais de vérification.

Ces fonds restent bloqués dans le contrat.

---

### Demande de vérification

Si une vérification devient nécessaire, le vendeur doit également déposer une seconde fois ces mêmes frais.

Le contrat dispose alors de deux montants identiques correspondant aux frais de vérification.

---

### Si le vendeur avait fourni le bon code

Lorsque l'intermédiaire confirme que le code de cession était correct :

* le vendeur récupère les frais qu'il vient de déposer ;
* l'intermédiaire reçoit les frais initialement déposés par l'acheteur.

Le coût de la vérification est donc finalement supporté par l'acheteur, puisque celui-ci a contesté un code pourtant valide ou n'a pas répondu dans les délais.

---

### Si le vendeur avait fourni un mauvais code

Lorsque l'intermédiaire constate que le code de cession est incorrect :

* l'intermédiaire reçoit les frais déposés par le vendeur ;
* l'acheteur récupère intégralement les frais qu'il avait déposés au début de la procédure.

Le vendeur supporte alors entièrement le coût de la vérification puisqu'il est responsable du litige.

Ce mécanisme permet d'inciter les deux parties à agir de bonne foi tout en rémunérant correctement l'intermédiaire lorsqu'une intervention supplémentaire devient nécessaire.

---

# 3. Cycle de vie de l'escrow

Le contrat suit une machine à états garantissant que les différentes étapes de la vente sont exécutées dans un ordre strictement défini.

Chaque transition correspond à une étape précise du processus de vente.

---

## 3.1 Création de l'escrow

Le contrat est déployé avec les paramètres suivants :

* l'adresse du vendeur ;
* l'adresse de l'acheteur ;
* l'adresse de l'intermédiaire ;
* l'adresse du token ERC-20 utilisé pour le paiement ;
* l'adresse du contrat NFT représentant le véhicule ;
* l'identifiant du NFT ;
* le prix du véhicule ;
* les frais de dépôt ;
* les frais de récupération ;
* les frais de vérification.

Lors de son déploiement, le contrat vérifie notamment :

* que toutes les adresses sont valides ;
* que les trois participants sont différents ;
* que les contrats ERC-20 et ERC-721 existent bien ;
* que tous les montants sont strictement positifs.

Le contrat entre alors dans l'état :

**Created**

---

## 3.2 Dépôt des actifs

Les deux parties déposent leurs actifs dans l'escrow.

Le vendeur dépose le NFT du véhicule.

L'acheteur dépose :

* le prix du véhicule ;
* les frais de vérification.

L'ordre de ces deux opérations n'a aucune importance.

Le contrat évolue automatiquement à travers différents états intermédiaires jusqu'à ce que les deux dépôts aient été effectués.

Une fois les deux actifs déposés, le contrat passe à l'état :

**AssetsDeposited**

---

## 3.3 Dépôt physique du véhicule

Le vendeur demande ensuite le dépôt physique du véhicule auprès de l'intermédiaire.

À cette occasion, il règle les frais de dépôt.

L'intermédiaire vérifie ensuite :

* que le NFT est bien détenu par l'escrow ;
* que les fonds nécessaires sont présents ;
* que le vendeur a effectivement demandé le dépôt.

Après confirmation de ces éléments :

* les frais de dépôt sont versés à l'intermédiaire ;
* un délai est ouvert pour permettre au vendeur de transmettre le code de cession.

Le contrat entre alors dans l'état :

**Ready**

---

## 3.4 Transmission du code de cession

Pendant la période autorisée, le vendeur transmet :

* le code de cession sous forme chiffrée ;
* le hash cryptographique du code original.

Le code original n'est jamais enregistré directement dans la blockchain.

Le chiffrement garantit que seul l'acheteur peut consulter le code transmis.

Une fois cette étape réalisée :

* le contrat ouvre une période de confirmation destinée à l'acheteur ;
* le contrat passe à l'état :

**Submitted**

À partir de cet instant, plusieurs scénarios deviennent possibles :

* l'acheteur confirme le code ;
* l'acheteur rejette le code ;
* l'acheteur ne répond pas avant la fin du délai.

Ces différents scénarios sont décrits dans les chapitres suivants.

# 4. Gestion des différents scénarios de confirmation

Une fois le code de cession transmis par le vendeur, le contrat entre dans l'état **Submitted**.

À partir de cet instant, le vendeur ne peut plus modifier le code transmis et l'acheteur dispose d'un délai limité pour prendre une décision.

Trois situations peuvent alors se présenter.

---

## 4.1 L'acheteur confirme le code

Il s'agit du scénario nominal de la vente.

L'acheteur déchiffre le code de cession reçu, vérifie qu'il est valide puis confirme celui-ci avant l'expiration du délai de confirmation.

Lorsque cette confirmation est effectuée, le contrat considère que le vendeur a correctement rempli ses obligations.

Les opérations suivantes sont alors exécutées automatiquement :

* le prix du véhicule est transféré au vendeur ;
* les frais de vérification initialement déposés par l'acheteur lui sont intégralement remboursés ;
* le NFT représentant le véhicule est transféré à l'acheteur.

Le contrat passe alors dans l'état **SaleConfirmed**.

À partir de cet instant, la transaction financière est définitivement terminée.

Il ne reste plus qu'à organiser la remise physique du véhicule.

---

## 4.2 L'acheteur rejette le code

Si l'acheteur estime que le code de cession fourni est incorrect, il peut explicitement le rejeter avant l'expiration du délai de confirmation.

Le contrat ne cherche jamais à déterminer lui-même si le code est correct.

Il se contente d'enregistrer qu'un désaccord existe entre les deux parties.

Le contrat passe alors immédiatement dans l'état **Disputed**.

À compter de cet instant, une nouvelle période est ouverte afin de permettre au vendeur de demander une vérification officielle du code par l'intermédiaire.

Durant cette période :

* le vendeur peut demander l'intervention de l'intermédiaire ;
* l'acheteur ne peut plus confirmer le code ;
* aucune partie ne peut récupérer les fonds tant que le litige n'est pas résolu.

Si le vendeur ne demande aucune vérification avant l'expiration de ce délai, l'une ou l'autre des parties pourra annuler l'escrow.

---

## 4.3 L'acheteur ne répond pas

Le troisième scénario correspond à l'absence totale de réaction de l'acheteur.

L'acheteur ne confirme pas le code et ne le rejette pas avant l'expiration du délai de confirmation.

Le contrat considère alors que le vendeur doit disposer d'une dernière possibilité de faire valider son code par un tiers de confiance.

Pour cette raison, une période supplémentaire est accordée au vendeur afin qu'il puisse demander une vérification officielle auprès de l'intermédiaire.

Deux situations sont alors possibles.

### Le vendeur demande la vérification

Si le vendeur effectue cette demande pendant le délai supplémentaire :

* il règle les frais de vérification ;
* le contrat enregistre officiellement la demande de vérification ;
* le contrat passe dans l'état **Disputed**.

Le litige pourra alors être résolu par l'intermédiaire.

### Le vendeur ne demande pas la vérification

Si le vendeur reste inactif jusqu'à l'expiration de cette seconde période, le contrat considère qu'il renonce implicitement à défendre la validité du code transmis.

L'escrow peut alors être annulé à l'initiative du vendeur ou de l'acheteur.

Le prix du véhicule est remboursé à l'acheteur et le vendeur devra récupérer physiquement le véhicule auprès de l'intermédiaire.

---

# 5. Gestion des litiges

Un litige apparaît lorsqu'il n'est plus possible de poursuivre normalement la vente après la transmission du code de cession.

Le contrat distingue clairement deux origines possibles d'un litige :

* l'acheteur rejette explicitement le code de cession ;
* l'acheteur ne répond pas et le vendeur demande une vérification officielle.

Dans les deux cas, le contrat atteint l'état **Disputed**.

À partir de cet instant, aucune décision n'est prise automatiquement par le smart contract.

La résolution du litige est entièrement confiée à l'intermédiaire.

---

## 5.1 Demande de vérification

Lorsqu'il souhaite faire vérifier son code de cession, le vendeur demande officiellement l'intervention de l'intermédiaire.

Cette opération implique le paiement des frais de vérification.

Le contrat enregistre alors la demande de vérification et le paiement des frais correspondants.

À partir de cet instant, la vente est suspendue jusqu'à ce que l'intermédiaire procède à la vérification du code de cession et rende sa décision.

Durant cette période, les fonds demeurent bloqués dans l'escrow, le NFT reste détenu par le contrat et aucune des parties ne peut poursuivre ou annuler la transaction tant que le litige n'a pas été résolu.

---

## 5.2 Vérification du code de cession

La vérification est réalisée entièrement hors chaîne.

L'intermédiaire récupère le véritable code de cession auprès du vendeur, procède aux contrôles nécessaires puis calcule lui-même le hash cryptographique correspondant.

Le contrat ne reçoit jamais le code de cession lui-même.

L'intermédiaire calcule le hash cryptographique du code de cession qu'il a vérifié, puis le transmet au smart contract.

Le contrat compare alors ce hash avec celui qui avait été enregistré lors de la soumission initiale du code par le vendeur.

Si les deux hash sont identiques, le contrat considère que le vendeur avait transmis un code de cession valide. Dans le cas contraire, il conclut que le code fourni était incorrect.



---

## 5.3 Code de cession valide

Lorsque le hash calculé par l'intermédiaire correspond au hash enregistré dans le contrat, le vendeur est reconnu comme ayant fourni un code correct.

Le contrat exécute alors automatiquement les opérations suivantes :

* le vendeur reçoit le prix du véhicule ;
* le vendeur récupère les frais de vérification qu'il avait déposés ;
* l'intermédiaire reçoit les frais de vérification initialement déposés par l'acheteur ;
* le NFT est transféré à l'acheteur.

Ainsi, le coût de la vérification est finalement supporté par l'acheteur, puisque la contestation (ou l'absence de réponse) n'était pas justifiée.

Le contrat quitte l'état **Disputed** et entre dans l'état **SaleConfirmed**.

La transaction peut alors se poursuivre normalement jusqu'à la remise physique du véhicule.

---

## 5.4 Code de cession invalide

Si les deux hash ne correspondent pas, le contrat considère que le vendeur avait transmis un code erroné.

Les conséquences sont les suivantes :

* le prix du véhicule est intégralement remboursé à l'acheteur ;
* les frais de vérification déposés par l'acheteur lui sont également remboursés ;
* les frais de vérification déposés par le vendeur sont transférés à l'intermédiaire afin de rémunérer son intervention ;
* la vente est annulée.

Le vendeur devra ensuite récupérer physiquement son véhicule auprès de l'intermédiaire.

---

## 5.5 Rôle de l'intermédiaire

Le protocole considère l'intermédiaire comme un tiers de confiance certifié.

Toutes les opérations qu'il réalise sont supposées être effectuées lors d'une rencontre physique en présence du vendeur, de l'acheteur ou des deux.

Pour cette raison, aucune limite de temps n'est imposée à l'intermédiaire une fois qu'une demande de vérification a été effectuée.

Contrairement au vendeur ou à l'acheteur, l'intermédiaire n'est pas considéré comme un participant susceptible de bloquer volontairement la transaction.

Le contrat suppose que la vérification sera réalisée dans le cadre normal de la procédure de vente.

---

# 6. Gestion des annulations

Le contrat prévoit plusieurs mécanismes permettant d'annuler la vente lorsqu'il devient impossible de poursuivre normalement le processus.

Chaque scénario d'annulation possède des conséquences précises sur les actifs numériques et sur le véhicule physique.

---

## 6.1 Annulation avant le dépôt physique

Tant que le vendeur n'a pas demandé le dépôt physique du véhicule auprès de l'intermédiaire, l'escrow peut être annulé.

Si le prix du véhicule avait déjà été déposé, il est remboursé à l'acheteur.

Si le NFT avait déjà été déposé, celui-ci est détruit afin de mettre définitivement fin au processus de vente.

À ce stade, le véhicule physique n'ayant jamais été confié à l'intermédiaire, aucune récupération physique n'est nécessaire.

---

## 6.2 Le vendeur ne transmet jamais le code de cession

Après confirmation du dépôt physique du véhicule, le vendeur dispose d'un délai limité pour transmettre le code de cession.

Si ce délai expire sans qu'aucun code ne soit soumis, l'escrow peut être annulé.

Le prix du véhicule est alors remboursé à l'acheteur.

Le NFT est détruit.

Comme le véhicule est déjà entre les mains de l'intermédiaire, le vendeur devra ensuite organiser sa récupération physique.

---

## 6.3 L'acheteur ne répond pas et le vendeur ne demande pas la vérification

Lorsque l'acheteur ne répond pas au code transmis, une période supplémentaire est accordée au vendeur afin qu'il puisse demander une vérification officielle.

Si cette seconde période expire sans aucune demande de vérification, le contrat considère que le processus ne peut plus évoluer.

L'escrow peut alors être annulé.

Le prix du véhicule est remboursé à l'acheteur.

Le vendeur devra récupérer physiquement son véhicule auprès de l'intermédiaire.

---

## 6.4 Le vendeur fournit un code invalide

Après intervention de l'intermédiaire, si le code de cession est reconnu comme incorrect, le contrat annule immédiatement la vente.

L'acheteur récupère l'intégralité du prix du véhicule ainsi que les frais de vérification qu'il avait initialement déposés.

Les frais de vérification déposés par le vendeur sont versés à l'intermédiaire.

Le vendeur devra ensuite récupérer physiquement le véhicule.

---

## 6.5 Récupération du véhicule

Chaque fois qu'une annulation intervient après le dépôt physique du véhicule, celui-ci reste temporairement chez l'intermédiaire.

Le vendeur doit alors demander officiellement la récupération du véhicule.

Cette opération donne lieu au paiement des frais de récupération.

Une fois que l'intermédiaire confirme que le véhicule a bien été repris par le vendeur, ces frais lui sont transférés et le processus est définitivement terminé.

# 7. Gestion des délais

Le contrat utilise plusieurs délais afin d'éviter qu'une transaction reste bloquée indéfiniment à la suite de l'inaction de l'une des parties.

Chaque délai correspond à une étape précise du processus de vente.

L'expiration d'un délai ne provoque jamais automatiquement un changement d'état. En effet, un smart contract ne peut pas s'exécuter seul. Une transaction initiée par l'un des participants est toujours nécessaire pour faire évoluer le workflow.

---

## 7.1 Délai de transmission du code de cession

Une fois que l'intermédiaire confirme avoir reçu physiquement le véhicule, le vendeur dispose d'une période limitée pour transmettre le code de cession.

Ce délai poursuit deux objectifs :

* empêcher que le véhicule reste inutilement immobilisé chez l'intermédiaire ;
* protéger l'acheteur contre un vendeur qui ne terminerait jamais la procédure.

Si le vendeur ne transmet pas le code avant l'expiration de cette période, l'escrow peut être annulé.

Le véhicule restant chez l'intermédiaire, le vendeur devra ensuite organiser sa récupération.

---

## 7.2 Délai de confirmation du code

Après réception du code de cession chiffré, l'acheteur bénéficie d'une période de confirmation.

Durant cette période, il peut :

* confirmer que le code est correct ;
* rejeter le code ;
* ne réaliser aucune action.

Ce délai permet à l'acheteur de disposer d'un temps raisonnable pour :

* déchiffrer le code reçu ;
* effectuer les vérifications nécessaires ;
* signaler une éventuelle anomalie.

Si aucune réponse n'est donnée avant la fin de cette période, le vendeur bénéficie d'une dernière possibilité de faire intervenir l'intermédiaire.

---

## 7.3 Délai de demande de vérification

Le vendeur ne peut pas demander une vérification du code à n'importe quel moment.

Deux situations sont distinguées.

### L'acheteur rejette explicitement le code

Le contrat entre immédiatement dans l'état **Disputed**.

Le vendeur dispose alors d'un délai limité pour demander l'intervention de l'intermédiaire.

À défaut, le contrat considère que le vendeur renonce à défendre la validité du code transmis et l'escrow pourra être annulé.

---

### L'acheteur ne répond pas

Lorsque l'acheteur reste silencieux jusqu'à l'expiration du délai de confirmation, le vendeur bénéficie d'une période supplémentaire lui permettant de demander la vérification du code.

Si cette demande n'est pas effectuée avant la fin de cette seconde période, le contrat considère que le processus ne peut plus évoluer et autorise l'annulation de l'escrow.

---

## 7.4 Pourquoi aucun délai n'est prévu pour l'intermédiaire

Contrairement au vendeur et à l'acheteur, l'intermédiaire est considéré comme un tiers de confiance.

Toutes les opérations qu'il réalise sont supposées être effectuées lors d'une rencontre physique entre les parties.

Lorsqu'une demande de vérification est enregistrée, le contrat considère que le dossier est désormais pris en charge par l'intermédiaire.

Aucun délai maximal n'est donc imposé à ce dernier.

Ce choix simplifie le fonctionnement du contrat et reflète le processus réel, dans lequel la vérification est réalisée lors d'un rendez-vous organisé entre les participants.

---

# 8. Machine à états

Le contrat est entièrement piloté par une machine à états garantissant que les différentes opérations sont exécutées dans le bon ordre.

Chaque fonction du contrat vérifie systématiquement l'état courant avant d'autoriser son exécution.

Les états du contrat sont les suivants.

---

## Created

L'escrow vient d'être créé.

Aucun actif n'a encore été déposé.

---

## Funded

L'acheteur a déposé :

* le prix du véhicule ;
* les frais de vérification.

Le vendeur n'a pas encore déposé le NFT.

---

## NFTDeposited

Le vendeur a déposé le NFT représentant le véhicule.

L'acheteur n'a pas encore financé l'escrow.

---

## AssetsDeposited

Le NFT et les fonds sont désormais tous deux déposés.

Le vendeur peut demander le dépôt physique du véhicule auprès de l'intermédiaire.

---

## Ready

Le véhicule physique a été confirmé par l'intermédiaire.

Le vendeur dispose maintenant d'un délai pour transmettre le code de cession.

---

## Submitted

Le vendeur a transmis le code de cession.

Le contrat attend désormais la décision de l'acheteur.

Trois évolutions sont alors possibles :

* confirmation du code ;
* rejet du code ;
* absence de réponse.

---

## Disputed

Un litige est ouvert.

Le contrat attend désormais la résolution du différend par l'intermédiaire.

Aucun transfert financier définitif n'est effectué tant que cet état n'est pas quitté.

---

## SaleConfirmed

La vente est définitivement validée.

Le vendeur a reçu le prix du véhicule.

L'acheteur est devenu propriétaire du NFT.

Il ne reste plus qu'à organiser la remise physique du véhicule.

---

## Completed

La remise physique du véhicule a été confirmée.

Tous les frais ont été réglés.

Le NFT est détruit.

Le processus de vente est définitivement terminé.

---

## Cancelled

La vente a été interrompue.

Les remboursements nécessaires ont été effectués.

Selon le moment de l'annulation, le vendeur peut encore devoir récupérer physiquement le véhicule auprès de l'intermédiaire.

---

# 9. Résumé des scénarios de fin

Le contrat prévoit uniquement deux résultats possibles.

---

## 9.1 Vente terminée avec succès

La vente est considérée comme réussie lorsque :

* le vendeur a fourni un code valide ;
* le paiement a été effectué ;
* le NFT a été transféré à l'acheteur ;
* le véhicule a été remis physiquement à l'acheteur.

Le contrat termine alors dans l'état **Completed**.

À ce stade :

* le vendeur a reçu le prix du véhicule ;
* l'intermédiaire a reçu les différents frais correspondant aux services réellement réalisés ;
* l'acheteur est devenu propriétaire du véhicule.

Le NFT est détruit afin de marquer définitivement la fin du processus d'escrow.

---

## 9.2 Vente annulée

Une vente peut être annulée dans plusieurs situations :

* le vendeur ne dépose jamais le code de cession ;
* le vendeur ne demande jamais la vérification après un litige ;
* l'intermédiaire constate que le code de cession est invalide ;
* la vente est annulée avant le dépôt physique du véhicule.

Dans tous ces cas :

* l'acheteur récupère les fonds qui lui reviennent ;
* le NFT est détruit ;
* si le véhicule avait déjà été déposé auprès de l'intermédiaire, le vendeur devra organiser sa récupération.

Le contrat termine alors dans l'état **Cancelled**.

---

# 10. Conclusion

Ce smart contract met en œuvre un mécanisme d'escrow permettant de sécuriser la vente d'un véhicule entre particuliers en combinant des garanties offertes par la blockchain avec l'intervention d'un intermédiaire certifié.

Le contrat protège les deux parties contre les principaux risques liés à la transaction :

* absence de paiement ;
* absence de dépôt du NFT ;
* absence de transmission du code de cession ;
* absence de réponse de l'acheteur ;
* transmission d'un code de cession invalide.

Chaque étape est strictement contrôlée par une machine à états, empêchant toute action réalisée dans un ordre incorrect.

Les différents délais empêchent également qu'une vente reste bloquée à cause de l'inaction du vendeur ou de l'acheteur.

Enfin, le protocole repose volontairement sur un intermédiaire certifié pour toutes les opérations nécessitant une vérification physique ou une expertise extérieure, notamment la vérification du code de cession, la réception du véhicule et sa remise finale.

Cette approche hybride permet de combiner l'automatisation et la transparence offertes par les smart contracts avec les exigences pratiques et réglementaires propres à la vente d'un véhicule.

