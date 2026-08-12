# Test_Factory.md

# Documentation des tests --- VehicleSaleFactory

## Introduction

Ce document décrit les tests unitaires du contrat
**VehicleSaleFactory**.

La suite vérifie le rôle de la factory dans la création d'une vente :
utilisation des contrats `VehicleNFT` et ERC20 configurés au
déploiement, création du NFT, déploiement d'un nouvel escrow,
association entre le NFT et cet escrow, transmission du prix et des
frais fixes, ainsi que validation des données d'entrée.

Dans la nouvelle version du contrat, le vendeur n'est plus fourni comme
paramètre à `createVehicleSale()` : il correspond directement à
`msg.sender`. Le token ERC20 est également défini une seule fois dans le
constructeur de la factory. Enfin, `depositFee`, `pickupFee` et
`cancellationFee` ne sont plus fournis lors de la création d'une vente :
ils sont définis comme constantes dans `VehicleSaleFactory`.

La suite vérifie également que plusieurs ventes peuvent être créées
successivement avec des NFT et des contrats d'escrow distincts.

------------------------------------------------------------------------

## Environnement de test

Chaque test repart d'un environnement propre créé par
`setUpVehicleSaleFactoryContract()`.

Cet environnement contient notamment :

-   un contrat `VehicleNFT` ;
-   un `MockTokenERC20` représentant le token utilisé pour les paiements
    ;
-   une instance de `VehicleSaleFactory` configurée avec les adresses du
    contrat `VehicleNFT` et du token ERC20 ;
-   un vendeur ;
-   un acheteur ;
-   un intermédiaire ;
-   une adresse `other`, utilisée notamment pour représenter une adresse
    qui n'est pas un contrat ou un second vendeur ;
-   le prix du véhicule ;
-   les valeurs correspondant aux frais fixes de dépôt, de récupération
    et d'annulation.

Les montants utilisés pour les frais correspondent aux constantes de la
factory :

-   `DEPOSIT_FEE` : 20 tokens avec 6 décimales ;
-   `PICKUP_FEE` : 10 tokens avec 6 décimales ;
-   `CANCELLATION_FEE` : 50 tokens avec 6 décimales.

Après le déploiement de la factory, celle-ci est configurée comme
factory autorisée dans `VehicleNFT`. Elle peut ainsi créer les NFT et
les associer aux escrows qu'elle déploie.

Le `beforeEach` recrée cet environnement avant chaque test afin que les
scénarios restent indépendants.

------------------------------------------------------------------------

# 1. Déploiement

## Objectif

Vérifier que `VehicleSaleFactory` est correctement associée aux contrats
`VehicleNFT` et ERC20 utilisés par les ventes, que les frais fixes
possèdent les valeurs attendues et que le constructeur refuse des
adresses invalides.

### Test : `Should deploy with the correct VehicleNFT contract`

La factory est déployée avec l'adresse du contrat `VehicleNFT` créé pour
le test.

Le test vérifie que l'adresse enregistrée par `VehicleSaleFactory`
correspond exactement à l'adresse de cette instance de `VehicleNFT`.

Cela garantit que les futures ventes utiliseront le contrat NFT prévu
lors du déploiement de la factory.

### Test : `Should deploy with the correct ERC20 token contract`

La factory est déployée avec l'adresse du `MockTokenERC20`.

Le test vérifie que `tokenERC20` contient exactement cette adresse.

Le token de paiement est donc défini au niveau de la factory et sera
utilisé par tous les escrows qu'elle crée.

### Test : `Should deploy with the correct fixed fees`

Le test vérifie les trois constantes financières de la factory :

-   `DEPOSIT_FEE` correspond à `depositFee` ;
-   `PICKUP_FEE` correspond à `pickupFee` ;
-   `CANCELLATION_FEE` correspond à `cancellationFee`.

Cela garantit que les frais transmis automatiquement à chaque nouvel
escrow correspondent aux valeurs définies dans la factory.

### Test : `Should reject a zero VehicleNFT address`

Une nouvelle factory est déployée en utilisant l'adresse zéro comme
adresse de `VehicleNFT`.

Le déploiement doit échouer avec l'erreur `InvalidAddress`.

Ce test garantit qu'une factory ne peut pas être créée sans référence
vers un contrat NFT.

### Test : `Should reject a non-contract VehicleNFT address`

Le test essaie de déployer une factory en utilisant l'adresse du compte
`other` à la place d'un contrat `VehicleNFT`.

Le déploiement doit échouer avec `InvalidAddress`.

La validation ne se limite donc pas à vérifier que l'adresse est
différente de zéro : l'adresse fournie doit également correspondre à un
contrat déployé.

### Test : `Should reject a zero ERC20 token address`

Une nouvelle factory est déployée avec une adresse ERC20 égale à
l'adresse zéro.

Le déploiement doit échouer avec `InvalidAddress`.

Le token ERC20 étant désormais configuré dans le constructeur, sa
validité est vérifiée au moment du déploiement de la factory et non plus
lors de chaque création de vente.

### Test : `Should reject a non-contract ERC20 token address`

Le test essaie d'utiliser l'adresse du compte `other` comme adresse du
token ERC20.

Le déploiement doit échouer avec `InvalidAddress`.

Cela garantit que l'adresse ERC20 enregistrée par la factory correspond
réellement à un contrat déployé.

------------------------------------------------------------------------

# 2. Création d'une vente

## Objectif

Vérifier qu'un appel à `createVehicleSale()` met correctement en place
les éléments on-chain nécessaires à une nouvelle vente.

La fonction reçoit uniquement l'acheteur, l'intermédiaire et le prix du
véhicule. Le vendeur correspond à l'appelant (`msg.sender`), tandis que
le token ERC20 et les différents frais proviennent directement de la
configuration de la factory.

### Test : `Should create a complete vehicle sale`

Une vente est créée par le vendeur avec un acheteur, un intermédiaire et
un prix de véhicule.

Le test vérifie d'abord que le premier NFT créé, le token `0`,
appartient au vendeur ayant appelé `createVehicleSale()`.

Il récupère ensuite l'escrow associé au token et vérifie que son adresse
n'est pas l'adresse zéro. Cela confirme qu'un contrat d'escrow a bien
été créé et associé au NFT.

Le test accède alors au `VehicleSaleEscrow` nouvellement déployé et
vérifie toute sa configuration :

-   le vendeur correspond au compte ayant appelé la factory ;
-   l'acheteur correspond à l'adresse fournie ;
-   l'intermédiaire est correctement enregistré ;
-   le contrat ERC20 correspond au token configuré dans la factory ;
-   le contrat NFT correspond au `VehicleNFT` utilisé par la factory ;
-   l'identifiant du véhicule est `0` ;
-   le prix du véhicule correspond à `vehiclePrice` ;
-   les frais de dépôt correspondent à `DEPOSIT_FEE` ;
-   les frais de récupération correspondent à `PICKUP_FEE` ;
-   les frais d'annulation correspondent à `CANCELLATION_FEE`.

Ce test valide donc l'opération principale de la factory : elle crée le
NFT, déploie l'escrow avec la configuration commune et les informations
propres à la vente, puis relie correctement les deux.

### Test : `Should use the caller as seller`

Une vente est créée en connectant explicitement le compte `seller` à la
factory.

Le test récupère ensuite l'escrow créé et vérifie :

-   que le NFT appartient à `seller` ;
-   que `getSeller()` dans l'escrow retourne également l'adresse de
    `seller`.

Ce test vérifie directement la nouvelle logique selon laquelle le
vendeur n'est plus un paramètre de `createVehicleSale()` mais correspond
à `msg.sender`.

### Test : `Should emit the VehicleSaleCreated event`

Vérifie qu'une création réussie émet l'événement `VehicleSaleCreated`.

Le test récupère l'événement dans les logs de la transaction et vérifie
qu'il existe.

Il contrôle ensuite :

-   l'adresse de l'escrow ;
-   l'adresse du contrat `VehicleNFT` ;
-   l'adresse du vendeur ;
-   l'adresse de l'acheteur ;
-   l'adresse de l'intermédiaire ;
-   l'identifiant du NFT, égal à `0` pour la première vente.

L'adresse `escrow` de l'événement est comparée à l'adresse associée au
token `0` dans `VehicleNFT`.

------------------------------------------------------------------------

# 3. Validation des paramètres

## Objectif

Vérifier que `createVehicleSale()` refuse une vente lorsque l'un de ses
paramètres obligatoires est invalide.

La nouvelle fonction ne reçoit plus que trois paramètres :

-   `_buyer` ;
-   `_intermediary` ;
-   `_vehiclePrice`.

Le vendeur provient de `msg.sender`, le token ERC20 du constructeur et
les frais des constantes de la factory. Les anciens tests vérifiant un
vendeur nul, un token ERC20 nul ou des frais nuls dans
`createVehicleSale()` ne sont donc plus applicables.

### Test : `Should reject a zero buyer address`

La factory reçoit une adresse acheteur nulle.

La création doit échouer avec `InvalidAddress`.

Une vente ne peut donc pas être créée sans acheteur valide.

### Test : `Should reject a zero intermediary address`

La création est effectuée avec une adresse intermédiaire nulle.

L'appel doit échouer avec `InvalidAddress`.

Cela garantit que chaque vente possède un intermédiaire défini dès sa
création.

### Test : `Should reject a zero vehicle price`

Le prix du véhicule est fixé à zéro.

L'appel à `createVehicleSale()` doit échouer avec `InvalidAmount`.

Toute vente créée par la factory doit donc avoir un prix strictement
positif.

------------------------------------------------------------------------

# 4. Ventes multiples

## Objectif

Vérifier que la même factory peut créer plusieurs ventes successives
sans mélanger les NFT et les contrats d'escrow associés, et que
plusieurs vendeurs peuvent utiliser la même factory.

### Test : `Should create multiple independent vehicle sales`

Le test crée successivement deux ventes depuis le même compte vendeur,
avec le même acheteur, le même intermédiaire et le même prix.

Il vérifie ensuite que :

-   le token `0` appartient au vendeur ;
-   le token `1` appartient au vendeur ;
-   les deux tokens sont associés à des escrows différents ;
-   le premier escrow utilise le token `0` ;
-   le second escrow utilise le token `1` ;
-   les deux escrows possèdent le bon vendeur ;
-   les deux escrows possèdent le bon acheteur ;
-   les deux escrows possèdent le bon intermédiaire ;
-   les deux utilisent le même contrat ERC20 configuré dans la factory ;
-   les deux utilisent le même contrat `VehicleNFT` ;
-   les deux utilisent le même prix du véhicule ;
-   les deux reçoivent les mêmes frais fixes de dépôt, de récupération
    et d'annulation.

Le fait d'utiliser les mêmes participants permet de vérifier que
l'indépendance des ventes repose bien sur la création d'un nouveau NFT
et d'un nouvel escrow à chaque appel.

### Test : `Should create sales for different sellers`

Le test crée une première vente depuis le compte `seller`, puis une
seconde depuis le compte `other`.

Il vérifie que :

-   le token `0` appartient à `seller` ;
-   le token `1` appartient à `other` ;
-   les deux tokens possèdent des escrows différents ;
-   le premier escrow enregistre `seller` comme vendeur ;
-   le second escrow enregistre `other` comme vendeur.

Ce scénario confirme que la factory n'est pas liée à un vendeur unique :
chaque appelant devient le vendeur de la vente qu'il crée.

------------------------------------------------------------------------

# 5. Résumé de la couverture

La suite contient **15 tests**.

  ------------------------------------------------------------------------
  Section                   Nombre de tests Comportement principal vérifié
  ------------------------- --------------- ------------------------------
  Déploiement                             7 Configuration de `VehicleNFT`,
                                            du token ERC20, des frais
                                            fixes et validation des
                                            adresses du constructeur

  Création d'une vente                    3 Création du NFT, utilisation
                                            de `msg.sender`, configuration
                                            de l'escrow et événement

  Validation des paramètres               3 Validation de l'acheteur, de
                                            l'intermédiaire et du prix

  Ventes multiples                        2 Indépendance des ventes et
                                            utilisation de plusieurs
                                            vendeurs

  **Total**                          **15** 
  ------------------------------------------------------------------------

------------------------------------------------------------------------

# Conclusion

Les tests vérifient que `VehicleSaleFactory` remplit correctement son
rôle de point de création des ventes avec sa nouvelle architecture.

Le contrat `VehicleNFT` et le token ERC20 sont désormais configurés une
seule fois lors du déploiement de la factory. Le constructeur vérifie
que leurs adresses sont non nulles et correspondent à des contrats
déployés.

Les frais de dépôt, de récupération et d'annulation sont définis
directement comme constantes dans la factory. Les tests vérifient leurs
valeurs et confirment qu'elles sont correctement transmises aux nouveaux
escrows.

Lors de `createVehicleSale()`, le vendeur est automatiquement déterminé
à partir de `msg.sender`. L'appelant fournit uniquement l'acheteur,
l'intermédiaire et le prix du véhicule. La factory crée alors un nouveau
NFT pour ce vendeur, déploie un `VehicleSaleEscrow` avec la
configuration appropriée et associe le NFT au nouvel escrow.

Les validations empêchent la création d'une vente lorsque l'acheteur ou
l'intermédiaire utilise l'adresse zéro, ou lorsque le prix du véhicule
vaut zéro.

Enfin, les scénarios de ventes multiples confirment que plusieurs ventes
peuvent être créées indépendamment, y compris par des vendeurs
différents, tout en partageant le même `VehicleNFT`, le même token ERC20
et les mêmes frais définis par la factory.
