# Test_NFT.md

# Documentation des tests -- VehicleNFT

## Introduction

Ce document décrit les tests unitaires du contrat **VehicleNFT**.

La suite vérifie le comportement spécifique du NFT utilisé dans le système de vente : création des tokens, association avec leur escrow, génération des métadonnées on-chain, restrictions de transfert, destruction des NFT et indépendance entre plusieurs ventes.

Contrairement à un ERC-721 classique, `VehicleNFT` n'est pas destiné à circuler librement entre les utilisateurs. Les tests vérifient donc en particulier que chaque NFT reste lié au workflow de la vente pour laquelle il a été créé.

---

## Environnement de test

Chaque test repart d'un environnement propre créé par `setUpVehicleNFTContract()`.

La configuration comprend notamment :

- `owner`, utilisé pour déployer `VehicleNFT` et configurer la factory autorisée ;
- `mockFactory`, qui simule `VehicleSaleFactory` et permet de tester les appels réservés à la factory ;
- `seller1` et `buyer1`, associés à une première vente ;
- `seller2` et `buyer2`, associés à une seconde vente ;
- `mockEscrow1` et `mockEscrow2`, utilisés pour simuler les opérations qu'un véritable `VehicleSaleEscrow` effectuerait sur le NFT ;
- `other`, utilisé pour tester les actions effectuées par une adresse non autorisée.

Le redéploiement des contrats avant chaque test garantit que les scénarios restent indépendants les uns des autres.

---

# 1. Déploiement

## Objectif

Vérifier les propriétés ERC-721 initiales du contrat et confirmer qu'aucun NFT n'existe avant le premier mint.

### Test : `Should have the correct name`

Vérifie que le nom ERC-721 exposé par le contrat est :

`Vehicle NFT`

Cela confirme que la collection est correctement initialisée.

### Test : `Should have the correct symbol`

Vérifie que le symbole ERC-721 est :

`VNFT`

### Test : `Should start with no existing tokens`

Vérifie qu'aucun NFT n'est créé automatiquement lors du déploiement.

L'appel à `ownerOf(0)` doit échouer avec `ERC721NonexistentToken(0)`, ce qui confirme que le premier token n'existe qu'après un appel explicite à la fonction de mint.

---

# 2. Création des NFT

## Objectif

Vérifier que les NFT ne peuvent être créés que par la factory autorisée et que les identifiants sont attribués correctement.

### Test : `Should prevent a non-factory from minting`

Une adresse extérieure essaie d'appeler directement `mint()`.

L'appel doit échouer avec `NotTheFactory`.

Ce test garantit que la création de nouveaux VehicleNFT passe obligatoirement par la factory configurée.

### Test : `Should mint token 0 to the requested address`

La factory simulée crée le premier NFT pour `seller1`.

Le test vérifie que :

- le premier identifiant attribué est `0` ;
- `seller1` devient propriétaire de ce token.

### Test : `Should increment the token ID`

Deux NFT sont créés successivement.

Le test vérifie que :

- le token `0` appartient à `seller1` ;
- le token `1` appartient à `seller2` ;
- le token `2` n'existe pas encore.

Cela confirme que les identifiants sont attribués séquentiellement à partir de zéro.

### Test : `Should emit a Transfer event`

Vérifie le comportement standard ERC-721 lors de la création d'un NFT.

Le mint du token `0` doit émettre l'événement `Transfer` :

- depuis l'adresse zéro ;
- vers `seller1` ;
- pour le token `0`.

### Test : `Should reject minting to the zero address`

La factory essaie de créer un NFT pour l'adresse zéro.

L'opération doit échouer avec `InvalidAddress`.

Ce test évite qu'un NFT soit créé sans propriétaire valide.

---

# 3. Association d'un NFT à son escrow

## Objectif

Vérifier qu'un NFT peut être associé à un seul escrow et que cette association ne peut être définie que par la factory.

Cette relation est essentielle car elle détermine quel escrow sera autorisé à transférer ou détruire le NFT pendant la vente.

### Test : `Should allow the factory to configure the escrow`

Après création du token `0`, la factory l'associe à `mockEscrow1`.

Le test vérifie que `getEscrow(0)` retourne bien l'adresse de cet escrow.

### Test : `Should prevent a non-factory from configuring the escrow`

Une adresse non autorisée tente d'associer le token `0` à un escrow.

Le test vérifie que :

- l'appel échoue avec `NotTheFactory` ;
- aucune association n'est enregistrée après l'échec.

### Test : `Should reject the zero escrow address`

La factory tente d'associer un NFT à l'adresse zéro.

L'opération doit échouer avec `InvalidAddress`.

Le contrat empêche ainsi la création d'une association inutilisable.

### Test : `Should reject configuring a nonexistent token`

La factory tente de configurer l'escrow du token `1` alors que seul le token `0` existe.

L'appel doit échouer avec `ERC721NonexistentToken(1)`.

Aucune association ne peut donc être créée pour un NFT inexistant.

### Test : `Should reject assigning a second escrow to the same token`

Le token `0` est d'abord associé à `mockEscrow1`.

La factory tente ensuite de remplacer cette association par `mockEscrow2`.

L'opération doit échouer avec `TokenAlreadyLinkedToEscrow`, et l'association avec `mockEscrow1` doit rester inchangée.

Ce test garantit qu'un NFT reste lié à la vente pour laquelle il a été créé.

---

# 4. Métadonnées on-chain

## Objectif

Vérifier que les métadonnées du NFT sont générées entièrement on-chain et qu'elles contiennent les informations correspondant au token demandé.

### Test : `Should return a Base64 JSON token URI`

Le token `0` est créé puis son `tokenURI` est récupéré.

Le test vérifie que :

- la valeur retournée est une chaîne de caractères ;
- elle utilise le préfixe `data:application/json;base64,` ;
- la partie Base64 peut être décodée ;
- le résultat constitue un JSON valide.

Cela confirme que les métadonnées ne dépendent pas d'un serveur ou d'une URL externe.

### Test : `Should contain the correct NFT name`

Après décodage du JSON, le champ `name` doit contenir :

`Vehicle NFT: 0`

Le nom des métadonnées reflète donc l'identifiant du token.

### Test : `Should contain a Base64 SVG image`

Le champ `image` du JSON doit être une image SVG elle-même intégrée sous forme de data URI Base64.

Le test vérifie le préfixe :

`data:image/svg+xml;base64,`

ainsi que la validité du contenu encodé.

### Test : `Should display the correct token ID in the SVG`

Le JSON puis l'image SVG sont décodés.

Le SVG doit contenir :

`TOKEN: 0`

Le test vérifie ainsi que l'image générée correspond au NFT consulté.

### Test : `Should generate different metadata for different token IDs`

Deux NFT sont créés.

Le test vérifie que :

- leurs noms contiennent respectivement les identifiants `0` et `1` ;
- leurs images encodées sont différentes.

Même si la structure graphique reste commune, les métadonnées restent propres à chaque token.

### Test : `Should reject tokenURI for a nonexistent token`

Un `tokenURI` est demandé pour un token qui n'existe pas.

L'appel doit échouer avec `ERC721NonexistentToken`.

Ce test garantit qu'aucune métadonnée n'est retournée pour un NFT inexistant ou déjà détruit.

---

# 5. Transferts depuis le vendeur

## Objectif

Vérifier que le vendeur ne peut pas librement transférer le NFT.

Le dépôt valide suit un mécanisme précis : le vendeur autorise l'escrow associé, puis cet escrow récupère lui-même le NFT.

### Test : `Should reject a transfer before escrow configuration`

Le vendeur essaie de transférer le NFT avant qu'un escrow lui soit associé.

L'opération doit échouer avec `NFTTransferNotAllowed`.

Un NFT ne peut donc pas circuler avant d'avoir été rattaché à sa vente.

### Test : `Should reject a direct transfer from the seller to the escrow`

Même après association de l'escrow, le vendeur essaie d'exécuter lui-même le transfert vers cet escrow.

Le transfert doit échouer et le vendeur doit rester propriétaire.

Ce test vérifie que le simple fait d'utiliser la bonne destination n'est pas suffisant : le transfert doit être exécuté par l'escrow associé.

### Test : `Should allow the escrow to pull an approved NFT from the seller`

Le vendeur autorise l'escrow à gérer son NFT.

L'escrow récupère ensuite le token et devient propriétaire.

Ce test reproduit le dépôt normal du NFT dans `VehicleSaleEscrow`.

### Test : `Should reject a seller transfer to another address`

Le vendeur tente d'envoyer directement le NFT à une autre adresse, notamment l'acheteur.

Le transfert doit échouer avec `NFTTransferNotAllowed`.

Le vendeur ne peut donc pas contourner l'escrow pour remettre directement le NFT à l'acheteur.

---

# 6. Transferts depuis l'escrow

## Objectif

Vérifier que l'escrow associé peut transférer le NFT uniquement vers les deux destinations prévues par le workflow :

- le vendeur ;
- l'acheteur.

### Test : `Should allow the escrow to transfer the NFT to the seller`

Le NFT est d'abord déposé dans `mockEscrow1`, puis l'escrow le retourne à `seller1`.

Le test vérifie que le vendeur redevient propriétaire.

Ce scénario correspond notamment au retour du NFT lors d'une annulation effectuée après le dépôt physique du véhicule.

### Test : `Should allow the escrow to transfer the NFT to the buyer`

Après avoir reçu le NFT, l'escrow le transfère à `buyer1`.

Le test vérifie :

- l'émission de l'événement ERC-721 `Transfer` ;
- la nouvelle propriété du NFT.

Ce scénario représente le transfert du NFT après confirmation de la vente.

### Test : `Should reject an escrow transfer to another address`

L'escrow tente d'envoyer le NFT à une adresse qui n'est ni le vendeur ni l'acheteur associés.

L'opération doit échouer avec `NFTTransferNotAllowed` et l'escrow doit rester propriétaire.

---

# 7. Transferts depuis l'acheteur

## Objectif

Vérifier que le NFT devient non transférable une fois remis à l'acheteur.

### Test : `Should reject every transfer from the buyer`

Le test reproduit d'abord le parcours autorisé :

`vendeur -> escrow -> acheteur`

Une fois propriétaire, l'acheteur tente de transférer le NFT :

- vers une adresse indépendante ;
- vers l'escrow ;
- vers le vendeur.

Toutes les tentatives doivent échouer avec `NFTTransferNotAllowed`.

Le test confirme donc qu'après la confirmation de la vente, l'acheteur peut détenir le NFT mais ne peut pas le faire circuler. Sa prochaine étape normale est sa destruction lorsque la remise physique du véhicule est confirmée.

---

# 8. Destruction du NFT

## Objectif

Vérifier que seul l'escrow associé au token peut détruire le NFT et que cette destruction fonctionne indépendamment de l'adresse qui détient actuellement le token.

Cette propriété est notamment importante lorsqu'une vente est annulée avant que le NFT ait été déposé dans l'escrow : l'escrow doit pouvoir détruire le NFT encore présent dans le wallet du vendeur.

### Test : `Should allow the associated escrow to burn the NFT`

Le token `0` est associé à `mockEscrow1`, puis cet escrow le détruit.

Le test vérifie :

- l'événement `Transfer` du propriétaire actuel vers l'adresse zéro ;
- l'inexistence du token après le burn.

L'autorisation dépend donc de l'escrow associé au token et non de la propriété actuelle du NFT.

### Test : `Should reject a burn by the seller`

Le vendeur tente de détruire directement son NFT.

L'appel doit échouer avec `NotTheEscrow` et le vendeur reste propriétaire.

### Test : `Should reject a burn by the buyer`

Le NFT est d'abord transféré à l'acheteur via l'escrow.

L'acheteur tente ensuite de le détruire lui-même.

L'appel doit échouer avec `NotTheEscrow`.

Le fait d'être propriétaire du NFT ne donne donc pas l'autorisation d'appeler `burn()`.

### Test : `Should reject a burn by another escrow`

Le token `0` est associé à `mockEscrow1`, tandis que `mockEscrow2` tente de le détruire.

L'appel doit échouer avec `NotTheEscrow`.

Chaque escrow possède donc une autorité limitée aux tokens qui lui sont explicitement associés.

### Test : `Should clear the associated escrow after the burn`

Après destruction du token, `getEscrow(0)` doit retourner l'adresse zéro.

Le test vérifie ainsi que la relation entre le NFT et son escrow est supprimée avec le token.

### Test : `Should not reuse a burned token ID`

Le token `0` est créé puis détruit.

Le NFT créé ensuite doit recevoir l'identifiant `1`.

Le contrat ne réutilise donc jamais l'identifiant d'un token détruit, ce qui préserve l'unicité historique des identifiants.

---

# 9. Gestion de plusieurs escrows

## Objectif

Vérifier que plusieurs ventes peuvent utiliser le même contrat `VehicleNFT` sans que les associations ou autorisations d'un token affectent les autres.

### Test : `Should associate each token with its own escrow`

Deux NFT sont créés puis associés à deux escrows différents :

- token `0` -> `mockEscrow1` ;
- token `1` -> `mockEscrow2`.

Le test vérifie que les deux associations sont stockées indépendamment.

### Test : `Should reject an escrow acting on another escrow's token`

`mockEscrow1` tente d'agir sur un token associé à `mockEscrow2`.

L'opération doit échouer avec `NotTheEscrow` et le propriétaire du second token doit rester inchangé.

Ce test confirme que l'autorisation d'un escrow n'est jamais globale.

### Test : `Should not affect token 1 when token 0 is burned`

Deux tokens sont configurés indépendamment.

Après destruction du token `0`, le test vérifie que :

- le token `0` n'existe plus ;
- le token `1` existe toujours ;
- le token `1` appartient toujours à `seller2` ;
- son association avec `mockEscrow2` est toujours présente.

La destruction d'un NFT et le nettoyage de son association n'ont donc aucun effet sur une autre vente.

---

# 10. Résumé de la couverture

La suite contient **36 tests** répartis comme suit :

| Section | Nombre de tests | Comportement principal vérifié |
| --- | ---: | --- |
| Déploiement | 3 | Configuration ERC-721 initiale et absence de tokens |
| Création des NFT | 5 | Autorisation de la factory, propriété, identifiants et mint |
| Association à l'escrow | 5 | Configuration unique et contrôle de la factory |
| Métadonnées | 6 | JSON Base64, SVG on-chain et données propres au token |
| Transferts depuis le vendeur | 4 | Dépôt uniquement via l'escrow autorisé |
| Transferts depuis l'escrow | 3 | Transfert uniquement vers vendeur ou acheteur |
| Transferts depuis l'acheteur | 1 | Blocage des transferts après réception |
| Destruction | 6 | Autorisation de l'escrow, nettoyage et identifiants |
| Plusieurs escrows | 3 | Indépendance des ventes et des autorisations |
| **Total** | **36** | |

---

# Conclusion

Les tests vérifient le cycle de vie complet prévu pour un `VehicleNFT`.

Un NFT est créé par la factory pour le vendeur puis associé à l'escrow de sa vente. À partir de cette association, ses mouvements sont strictement contrôlés : le vendeur ne peut pas le transférer librement, l'escrow peut le récupérer puis le remettre uniquement au vendeur ou à l'acheteur, et l'acheteur ne peut pas le transférer après réception.

La destruction suit la même logique d'autorisation : seul l'escrow associé peut supprimer le NFT, même lorsque celui-ci est encore détenu par le vendeur ou a déjà été remis à l'acheteur.

Enfin, les tests multi-escrows vérifient que plusieurs ventes peuvent partager le même contrat `VehicleNFT` tout en conservant des associations, des autorisations et des cycles de vie complètement indépendants.
