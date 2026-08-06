# Test_Factory.md

# Documentation des tests — VehicleSaleFactory

## Introduction

Ce document décrit l'ensemble des tests unitaires du contrat
**VehicleSaleFactory**. Ces tests vérifient le déploiement de la factory,
la création complète d'une vente de véhicule, la validation des paramètres
d'entrée ainsi que la gestion de plusieurs ventes indépendantes.

---

# 1. Déploiement

## Objectif

Vérifier que la factory est correctement initialisée avec un contrat
**VehicleNFT** valide.

### Tests

- **Should deploy with the correct VehicleNFT contract**
  - Vérifie que la factory référence correctement le contrat
    `VehicleNFT`.

- **Should reject a zero VehicleNFT address**
  - Vérifie que le constructeur refuse une adresse nulle.

- **Should reject a non-contract VehicleNFT address**
  - Vérifie que le constructeur refuse une adresse qui ne correspond
    pas à un contrat déployé.

---

# 2. Création d'une vente

## Objectif

Vérifier que la factory crée correctement une vente complète.

### Tests

- **Should create a complete vehicle sale**
  - Vérifie que le NFT est minté au vendeur.
  - Vérifie que le NFT est associé à un contrat d'escrow.
  - Vérifie que le contrat d'escrow est correctement déployé.
  - Vérifie que toutes les informations de configuration
    (participants, contrats, identifiant du NFT et montants)
    sont correctement initialisées.

- **Should emit the VehicleSaleCreated event**
  - Vérifie que l'événement `VehicleSaleCreated` est émis.
  - Vérifie les paramètres de l'événement :
    - adresse du contrat d'escrow ;
    - adresse du contrat `VehicleNFT` ;
    - vendeur ;
    - acheteur ;
    - intermédiaire ;
    - identifiant du NFT.

---

# 3. Validation des paramètres

## Objectif

Vérifier que la factory refuse toute configuration invalide.

### Tests

- **Should reject a zero seller address**
  - Vérifie qu'une adresse vendeur nulle est refusée.

- **Should reject a zero buyer address**
  - Vérifie qu'une adresse acheteur nulle est refusée.

- **Should reject a zero intermediary address**
  - Vérifie qu'une adresse intermédiaire nulle est refusée.

- **Should reject a zero ERC20 token address**
  - Vérifie qu'une adresse de contrat ERC20 nulle est refusée.

- **Should reject a zero vehicle price**
  - Vérifie qu'un prix du véhicule nul est refusé.

- **Should reject a zero deposit fee**
  - Vérifie que des frais de dépôt nuls sont refusés.

- **Should reject a zero pickup fee**
  - Vérifie que des frais de récupération nuls sont refusés.

- **Should reject a zero cancellation fee**
  - Vérifie que des frais d'annulation nuls sont refusés.

---

# 4. Ventes multiples

## Objectif

Vérifier que plusieurs ventes peuvent être créées de manière totalement
indépendante.

### Test

- **Should create multiple independent vehicle sales**
  - Vérifie que deux NFT distincts sont créés.
  - Vérifie que chaque NFT appartient au vendeur.
  - Vérifie que chaque NFT est associé à un contrat d'escrow différent.
  - Vérifie que les deux ventes sont totalement indépendantes.