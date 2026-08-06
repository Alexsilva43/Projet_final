# Test_NFT.md

# Documentation des tests de VehicleNFT

Ce document explique les tests unitaires présents dans `VehicleNFT.ts`. La suite vérifie le comportement personnalisé de `VehicleNFT` : création des NFT, association aux contrats escrow, métadonnées on-chain, restrictions de transfert, destruction des NFT et gestion de plusieurs escrows.

## Environnement de test

Chaque test commence avec de nouveaux contrats déployés par `setUpVehicleNFTContract()`.

La configuration contient :

- `owner` : déploie `VehicleNFT` et configure la factory autorisée ;
- `factory` : déploie les contrats `MockEscrow` utilisés dans les tests ;
- `mockFactory` : contrat simulant `VehicleSaleFactory`, seul autorisé à appeler `mint()` et `setEscrow()` de `VehicleNFT` ;
- `seller1` et `buyer1` : vendeur et acheteur associés à `mockEscrow1` ;
- `seller2` et `buyer2` : vendeur et acheteur associés à `mockEscrow2` ;
- `other` : compte indépendant utilisé pour tester les actions non autorisées ;
- `mockEscrow1` et `mockEscrow2` : contrats escrow minimaux capables d'appeler les fonctions de `VehicleNFT`.

Les mocks sont nécessaires car `VehicleNFT` vérifie l'adresse du contrat escrow à travers `msg.sender`. Le hook `beforeEach` redéploie tous les contrats avant chaque test. Les tests sont donc indépendants les uns des autres.

## Déploiement

### Should have the correct name

Vérifie que le nom de la collection ERC-721 est `Vehicle NFT` immédiatement après son déploiement.

### Should have the correct symbol

Vérifie que le symbole de la collection ERC-721 est `VNFT` immédiatement après son déploiement.

### Should start with no existing tokens

Appelle `ownerOf(0)` avant toute création de NFT. L'appel doit échouer avec `ERC721NonexistentToken(0)`, ce qui prouve qu'aucun NFT n'est créé automatiquement au déploiement.

## Création des NFT

### Should prevent a non-factory from minting

Le compte `other` essaie d'appeler directement `mint()`. La transaction doit échouer avec `NotTheFactory`, confirmant que seul le contrat factory autorisé peut créer un NFT.

### Should mint token 0 to the requested address

Le contrat `MockFactory` crée le premier NFT pour `seller1`. Le test vérifie que `seller1` devient propriétaire du token `0`.

### Should increment the token ID

Le contrat `MockFactory` crée un NFT pour `seller1`, puis un autre pour `seller2`. Le test vérifie que :

- le token `0` appartient à `seller1` ;
- le token `1` appartient à `seller2` ;
- le token `2` n'existe pas encore.

Cela confirme que les identifiants commencent à zéro et sont incrémentés de un après chaque création.

### Should emit a Transfer event

Vérifie l'événement standard ERC-721 émis lors d'un mint. La création du token `0` doit émettre `Transfer` depuis l'adresse zéro vers `seller1`.

### Should reject minting to the zero address

Le contrat `MockFactory` essaie de créer un NFT pour `address(0)`. La transaction doit échouer avec `InvalidAddress`, empêchant la création d'un NFT sans propriétaire valide.

## Configuration de l'escrow

### Should allow the factory to configure the escrow

Après la création du token `0`, le contrat `MockFactory` l'associe à `mockEscrow1`. Le test appelle `getEscrow(0)` et vérifie que l'adresse enregistrée est correcte.

### Should prevent a non-factory from configuring the escrow

Le compte `other` essaie d'associer le token `0` à un escrow. La transaction doit échouer avec `NotTheFactory`. Le test vérifie aussi que l'adresse enregistrée reste l'adresse zéro : la transaction échouée n'a donc pas modifié le stockage.

### Should reject the zero escrow address

Le contrat `MockFactory` essaie d'associer le token `0` à `address(0)`. La transaction doit échouer avec `InvalidAddress`, garantissant que l'escrow configuré possède une adresse valide.

### Should reject configuring a nonexistent token

Seul le token `0` existe, mais le contrat `MockFactory` essaie de configurer le token `1`. La transaction doit échouer avec `ERC721NonexistentToken(1)`, ce qui empêche la création d'une association pour un NFT inexistant.

### Should reject assigning a second escrow to the same token

Le contrat `MockFactory` associe d'abord le token `0` à `mockEscrow1`, puis essaie de le réassocier à `mockEscrow2`. La seconde transaction doit échouer avec `TokenAlreadyLinkedToEscrow`. L'association initiale doit rester inchangée.

Cela confirme que l'escrow d'un token ne peut pas être remplacé tant que le token existe.

## Métadonnées

### Should return a Base64 JSON token URI

Crée le token `0`, puis récupère son `tokenURI`. Le test vérifie que :

- le résultat est une chaîne de caractères ;
- il commence par `data:application/json;base64,` ;
- le contenu restant utilise un encodage Base64 valide ;
- le décodage produit un JSON valide.

Cela confirme que les métadonnées sont générées entièrement on-chain sous forme de data URI.

### Should contain the correct NFT name

Décode les métadonnées JSON du token `0` et vérifie que le champ `name` contient `Vehicle NFT: 0`.

### Should contain a Base64 SVG image

Décode les métadonnées JSON et vérifie le champ `image`. Sa valeur doit commencer par `data:image/svg+xml;base64,` et être suivie d'un contenu Base64 valide.

### Should display the correct token ID in the SVG

Décode les deux niveaux de métadonnées : d'abord le JSON, puis le SVG intégré. Le SVG obtenu doit contenir `TOKEN: 0`, prouvant que l'image affiche l'identifiant du NFT demandé.

### Should generate different metadata for different token IDs

Crée les tokens `0` et `1`, puis décode leurs métadonnées. Le test vérifie que :

- leurs noms sont respectivement `Vehicle NFT: 0` et `Vehicle NFT: 1` ;
- leurs images SVG encodées sont différentes.

Cela prouve que les métadonnées contiennent des informations propres à chaque token, même si tous les NFT utilisent le même visuel général.

### Should reject tokenURI for a nonexistent token

Appelle `tokenURI(0)` sans avoir créé le token `0`. L'appel doit échouer avec `ERC721NonexistentToken(0)`, garantissant que les métadonnées sont disponibles uniquement pour les NFT existants.

## Transferts effectués par le vendeur

Le vendeur ne peut pas envoyer directement le NFT. Il doit autoriser l'escrow configuré, puis cet escrow doit récupérer lui-même le NFT.

### Should reject a transfer before escrow configuration

Le vendeur essaie de transférer le token `0` à `mockEscrow1` avant que cet escrow soit associé au token. La transaction doit échouer avec `NFTTransferNotAllowed`.

### Should reject a direct transfer from the seller to the escrow

Après l'association de `mockEscrow1` au token `0`, le vendeur appelle directement `safeTransferFrom`. La transaction doit toujours échouer avec `NFTTransferNotAllowed`, et le vendeur doit rester propriétaire.

Choisir le bon destinataire n'est donc pas suffisant : l'escrow associé doit également être l'appelant qui exécute le transfert.

### Should allow the escrow to pull an approved NFT from the seller

Le vendeur autorise `mockEscrow1` à gérer le token `0`. Le mock appelle ensuite `safeTransferFrom` pour récupérer le NFT du vendeur et le transférer vers sa propre adresse. Le test vérifie que l'escrow devient propriétaire.

Cela représente le dépôt valide du NFT dans l'escrow.

### Should reject a seller transfer to another address

Le vendeur essaie de transférer directement le token `0` à l'acheteur sans passer par l'escrow. La transaction doit échouer avec `NFTTransferNotAllowed`.

## Transferts effectués par l'escrow

Une fois propriétaire du NFT, l'escrow peut le rendre au vendeur configuré ou le remettre à l'acheteur configuré. Il ne peut pas l'envoyer à une adresse indépendante.

### Should allow the escrow to transfer the NFT to the seller

Le test dépose d'abord le token `0` dans `mockEscrow1`. L'escrow le retransfère ensuite à `seller1`. La vérification finale confirme que le vendeur a récupéré le NFT.

Cela représente notamment la restitution du NFT après l'annulation d'une vente.

### Should allow the escrow to transfer the NFT to the buyer

Le test dépose le token `0` dans `mockEscrow1`, puis le transfère de l'escrow vers `buyer1`. Il vérifie :

- l'événement `Transfer` de l'escrow vers l'acheteur ;
- que l'acheteur est finalement propriétaire du token `0`.

Cela représente la remise du NFT à l'acheteur après la validation de la vente.

### Should reject an escrow transfer to another address

Après avoir reçu le token `0`, l'escrow essaie de l'envoyer au compte `other`. La transaction doit échouer avec `NFTTransferNotAllowed`, et l'escrow doit rester propriétaire.

## Transferts effectués par l'acheteur

### Should reject every transfer from the buyer

Le test exécute le parcours valide vendeur → escrow → acheteur. Une fois propriétaire du token `0`, `buyer1` essaie de le transférer :

- à une adresse indépendante ;
- à l'escrow ;
- au vendeur d'origine.

Chaque tentative doit échouer avec `NFTTransferNotAllowed`, et l'acheteur doit rester propriétaire. Le NFT devient donc non transférable après sa remise à l'acheteur.

## Destruction du NFT

La fonction `burn` est contrôlée par l'escrow associé à chaque token. Cet escrow peut détruire le NFT quel que soit son propriétaire actuel, car `burn` utilise l'opération interne de destruction ERC-721 et non un transfert nécessitant l'autorisation du propriétaire.

### Should allow the associated escrow to burn the NFT

Après l'association du token `0` à `mockEscrow1`, cet escrow le détruit. Le test vérifie :

- l'émission de `Transfer` depuis le propriétaire actuel vers l'adresse zéro ;
- que `ownerOf(0)` échoue ensuite avec `ERC721NonexistentToken(0)`.

Cela confirme que l'escrow associé peut détruire le token et que celui-ci n'existe plus après l'opération.

### Should reject a burn by the seller

Le vendeur appelle directement `burn(0)`. La transaction doit échouer avec `NotTheEscrow`, et le vendeur doit rester propriétaire.

### Should reject a burn by the buyer

Le test transfère d'abord le token `0` à `buyer1` en passant par l'escrow. Même si l'acheteur possède le NFT, son appel direct à `burn(0)` doit échouer avec `NotTheEscrow`. Il doit rester propriétaire après cet échec.

La propriété du NFT ne donne donc pas l'autorisation de le détruire.

### Should reject a burn by another escrow

Le token `0` est associé à `mockEscrow1`, mais `mockEscrow2` essaie de le détruire. La transaction doit échouer avec `NotTheEscrow`, et `seller1` doit rester propriétaire.

Cela prouve que l'autorisation de destruction est propre à l'escrow enregistré pour chaque token et n'est pas accordée globalement à tous les escrows.

### Should clear the associated escrow after the burn

Après la destruction du token `0` par `mockEscrow1`, `getEscrow(0)` doit retourner l'adresse zéro. Ce test vérifie le nettoyage personnalisé du mapping `vehicleEscrow`.

### Should not reuse a burned token ID

Le contrat `MockFactory` crée le token `0`, qui est ensuite détruit par son escrow. Le mint suivant doit créer le token `1` pour `seller2`, tandis que le token `0` reste inexistant.

Cela confirme que la destruction d'un token ne diminue pas et ne réinitialise pas le compteur d'identifiants.

## Gestion de plusieurs escrows

### Should associate each token with its own escrow

Le contrat `MockFactory` crée deux NFT et associe :

- le token `0` à `mockEscrow1` ;
- le token `1` à `mockEscrow2`.

Le test lit les deux valeurs et confirme que les associations sont enregistrées séparément pour chaque token.

### Should reject an escrow acting on another escrow's token

Après l'association du token `0` à `mockEscrow1` et du token `1` à `mockEscrow2`, `mockEscrow1` essaie de détruire le token `1`. La transaction doit échouer avec `NotTheEscrow`, et `seller2` doit rester propriétaire du token `1`.

Cela vérifie que l'autorité d'un escrow est limitée à son propre token.

### Should not affect token 1 when token 0 is burned

Le test crée deux tokens configurés indépendamment, puis détruit le token `0` avec `mockEscrow1`. Il vérifie ensuite que :

- le token `1` existe toujours et appartient encore à `seller2` ;
- le token `1` reste associé à `mockEscrow2` ;
- le token `0` n'existe plus.

Cela confirme que la destruction d'un NFT et la suppression de son escrow n'affectent ni la propriété ni la configuration d'un autre NFT.

## Résumé de la couverture

La suite contient 36 tests :

| Section | Tests | Comportement principal vérifié |
| --- | ---: | --- |
| Déploiement | 3 | Configuration ERC-721 initiale et absence de tokens |
| Création des NFT | 5 | Autorisation de la factory, propriété, identifiants, événement et validation d'adresse |
| Configuration de l'escrow | 5 | Autorisation de la factory, validation et association unique |
| Métadonnées | 6 | JSON Base64, SVG intégré, contenu propre au token et tokens inexistants |
| Transferts du vendeur | 4 | Configuration et récupération du NFT par l'escrow autorisé |
| Transferts de l'escrow | 3 | Transfert uniquement vers le vendeur ou l'acheteur |
| Transferts de l'acheteur | 1 | Blocage définitif des transferts après réception |
| Destruction | 6 | Autorisation par token, nettoyage et non-réutilisation des identifiants |
| Plusieurs escrows | 3 | Indépendance des configurations, autorisations et états |
| **Total** | **36** | |

Ensemble, ces tests vérifient le cycle de vie prévu du NFT :

1. Le contrat factory autorisé crée le NFT pour le vendeur.
2. Le contrat factory autorisé associe un escrow au token.
3. Le vendeur autorise cet escrow.
4. L'escrow récupère le NFT du vendeur.
5. L'escrow peut rendre le NFT au vendeur ou le remettre à l'acheteur.
6. L'acheteur ne peut plus transférer le NFT.
7. Seul l'escrow associé au token peut le détruire.
