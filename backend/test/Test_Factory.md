# Test_Factory.md

# Documentation des tests — VehicleSaleFactory

## Introduction

Ce document décrit les tests unitaires du contrat **VehicleSaleFactory**.

La suite vérifie le rôle de la factory dans la création d'une vente : utilisation du contrat `VehicleNFT` configuré, création du NFT, déploiement d'un nouvel escrow, association entre le NFT et cet escrow, transmission des paramètres de la vente et validation des données d'entrée.

Elle vérifie également que plusieurs ventes peuvent être créées successivement avec des NFT et des contrats d'escrow distincts.

---

## Environnement de test

Chaque test repart d'un environnement propre créé par `setUpVehicleSaleFactoryContract()`.

Cet environnement contient notamment :

- un contrat `VehicleNFT` ;
- un `MockTokenERC20` représentant le token utilisé pour les paiements ;
- une instance de `VehicleSaleFactory` configurée avec l'adresse du contrat `VehicleNFT` ;
- un vendeur ;
- un acheteur ;
- un intermédiaire ;
- une adresse `other`, utilisée notamment pour représenter une adresse qui n'est pas un contrat ;
- les montants utilisés pour le prix du véhicule et les différents frais.

Après le déploiement de la factory, celle-ci est configurée comme factory autorisée dans `VehicleNFT`. Elle peut ainsi créer les NFT et les associer aux escrows qu'elle déploie.

Le `beforeEach` recrée cet environnement avant chaque test afin que les scénarios restent indépendants.

---

# 1. Déploiement

## Objectif

Vérifier que `VehicleSaleFactory` est correctement associée au contrat `VehicleNFT` utilisé par les ventes et qu'elle refuse une configuration initiale invalide.

### Test : `Should deploy with the correct VehicleNFT contract`

La factory est déployée avec l'adresse du contrat `VehicleNFT` créé pour le test.

Le test vérifie que l'adresse enregistrée par `VehicleSaleFactory` correspond exactement à l'adresse de cette instance de `VehicleNFT`.

Cela garantit que les futures ventes utiliseront le contrat NFT prévu lors du déploiement de la factory.

### Test : `Should reject a zero VehicleNFT address`

Une nouvelle factory est déployée en utilisant l'adresse zéro comme adresse de `VehicleNFT`.

Le déploiement doit échouer avec l'erreur `InvalidAddress`.

Ce test garantit qu'une factory ne peut pas être créée sans référence vers un contrat NFT.

### Test : `Should reject a non-contract VehicleNFT address`

Le test essaie de déployer une factory en utilisant l'adresse du compte `other` à la place d'un contrat `VehicleNFT`.

Le déploiement doit échouer avec `InvalidAddress`.

La validation ne se limite donc pas à vérifier que l'adresse est différente de zéro : l'adresse fournie doit également correspondre à un contrat déployé.

---

# 2. Création d'une vente

## Objectif

Vérifier qu'un appel à `createVehicleSale()` met correctement en place les éléments on-chain nécessaires à une nouvelle vente.

La factory doit créer le NFT du véhicule, déployer un nouvel escrow avec les paramètres reçus et associer le NFT à cet escrow.

### Test : `Should create a complete vehicle sale`

Une vente est créée avec un vendeur, un acheteur, un intermédiaire, un token ERC20 et les différents montants financiers.

Le test vérifie d'abord que le premier NFT créé, le token `0`, appartient au vendeur.

Il récupère ensuite l'escrow associé au token et vérifie que son adresse n'est pas l'adresse zéro. Cela confirme qu'un contrat d'escrow a bien été créé et associé au NFT.

Le test accède alors au `VehicleSaleEscrow` nouvellement déployé et vérifie toute sa configuration :

- le vendeur correspond à l'adresse fournie à la factory ;
- l'acheteur correspond à l'adresse fournie ;
- l'intermédiaire est correctement enregistré ;
- le contrat ERC20 correspond au token choisi pour la vente ;
- le contrat NFT correspond au `VehicleNFT` utilisé par la factory ;
- l'identifiant du véhicule est `0` ;
- le prix du véhicule correspond à `vehiclePrice` ;
- les frais de dépôt correspondent à `depositFee` ;
- les frais de récupération correspondent à `pickupFee` ;
- les frais d'annulation correspondent à `cancellationFee`.

Ce test valide donc l'opération principale de la factory : à partir des paramètres d'une vente, elle crée un NFT, déploie son escrow et relie correctement les deux.

### Test : `Should emit the VehicleSaleCreated event`

Vérifie qu'une création réussie émet l'événement `VehicleSaleCreated`.

Le test récupère l'événement dans les logs de la transaction et vérifie qu'il existe.

Il contrôle ensuite les informations suivantes :

- l'adresse du contrat `VehicleNFT` ;
- l'adresse du vendeur ;
- l'adresse de l'acheteur ;
- l'adresse de l'intermédiaire ;
- l'identifiant du NFT, égal à `0` pour la première vente.

L'événement permet ainsi d'identifier les principaux éléments de la vente qui vient d'être créée.

> Remarque : dans le test actuel, l'adresse de l'escrow contenue dans l'événement n'est pas explicitement vérifiée. Son existence et son association au NFT sont vérifiées dans le test `Should create a complete vehicle sale`.

---

# 3. Validation des paramètres

## Objectif

Vérifier que la factory refuse de créer une vente lorsque l'un des paramètres obligatoires est invalide.

Les tests distinguent deux catégories d'erreurs :

- `InvalidAddress` pour les adresses obligatoires ;
- `InvalidAmount` pour les montants qui doivent être strictement supérieurs à zéro.

### Test : `Should reject a zero seller address`

Une création de vente est demandée avec une adresse vendeur égale à l'adresse zéro.

L'appel doit échouer avec `InvalidAddress`.

Cela garantit que toute vente possède un vendeur identifié.

### Test : `Should reject a zero buyer address`

La factory reçoit une adresse acheteur nulle.

La création doit échouer avec `InvalidAddress`.

Une vente ne peut donc pas être créée sans acheteur valide.

### Test : `Should reject a zero intermediary address`

La création est effectuée avec une adresse intermédiaire nulle.

L'appel doit échouer avec `InvalidAddress`.

Cela garantit que chaque vente possède un intermédiaire défini dès sa création.

### Test : `Should reject a zero ERC20 token address`

La factory reçoit l'adresse zéro à la place du contrat ERC20 utilisé pour les paiements.

La création doit échouer avec `InvalidAddress`.

Le test garantit donc qu'une vente ne peut pas être initialisée sans adresse de token de paiement.

### Test : `Should reject a zero vehicle price`

Le prix du véhicule est fixé à zéro.

L'appel à `createVehicleSale()` doit échouer avec `InvalidAmount`.

Toute vente créée par la factory doit donc avoir un prix strictement positif.

### Test : `Should reject a zero deposit fee`

Les frais de dépôt sont fixés à zéro.

La création doit échouer avec `InvalidAmount`.

### Test : `Should reject a zero pickup fee`

Les frais de récupération sont fixés à zéro.

La création doit échouer avec `InvalidAmount`.

### Test : `Should reject a zero cancellation fee`

Les frais d'annulation sont fixés à zéro.

La création doit échouer avec `InvalidAmount`.

Ces quatre derniers tests confirment que le prix du véhicule et chacun des frais nécessaires au fonctionnement de la vente doivent être définis avec une valeur supérieure à zéro.

---

# 4. Ventes multiples

## Objectif

Vérifier que la même factory peut créer plusieurs ventes successives sans mélanger les NFT et les contrats d'escrow associés.

### Test : `Should create multiple independent vehicle sales`

Le test crée successivement deux ventes avec les mêmes participants et les mêmes paramètres financiers.

Il vérifie ensuite que :

- le premier NFT créé possède l'identifiant `0` et appartient au vendeur ;
- le second NFT possède l'identifiant `1` et appartient également au vendeur ;
- chaque NFT possède une adresse d'escrow associée ;
- l'adresse de l'escrow du token `0` est différente de celle du token `1`.

Le fait d'utiliser les mêmes adresses de vendeur, d'acheteur et d'intermédiaire permet de vérifier que l'indépendance des ventes ne dépend pas de participants différents.

Chaque appel à `createVehicleSale()` produit donc une nouvelle instance d'escrow et un nouveau NFT, même lorsque les paramètres des deux ventes sont identiques.

---

# 5. Résumé de la couverture

La suite contient **14 tests**.

| Section | Nombre de tests | Comportement principal vérifié |
| --- | ---: | --- |
| Déploiement | 3 | Configuration du contrat `VehicleNFT` et validation de son adresse |
| Création d'une vente | 2 | Création du NFT, déploiement/configuration de l'escrow et événement |
| Validation des paramètres | 8 | Validation des participants, du token ERC20 et des montants |
| Ventes multiples | 1 | Création de NFT et d'escrows distincts pour plusieurs ventes |
| **Total** | **14** | |

---

# Conclusion

Les tests vérifient que `VehicleSaleFactory` remplit correctement son rôle de point de création des ventes.

Pour chaque vente valide, la factory crée un nouveau NFT pour le vendeur, déploie un `VehicleSaleEscrow` avec les participants et les paramètres financiers fournis, puis associe ce NFT au nouvel escrow.

Les validations empêchent la création d'une vente lorsque l'une des adresses obligatoires est nulle ou lorsqu'un montant requis vaut zéro. Le constructeur vérifie également que l'adresse `VehicleNFT` fournie correspond effectivement à un contrat déployé.

Enfin, le scénario de ventes multiples confirme que plusieurs ventes peuvent être créées avec les mêmes participants tout en obtenant des NFT distincts et des contrats d'escrow différents.
