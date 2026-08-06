# Test_Escrow.md

# Documentation des tests -- VehicleSaleEscrow

## Introduction

Ce document décrit l'ensemble des tests unitaires du contrat
**VehicleSaleEscrow**. Chaque groupe de tests valide une étape du
workflow de vente d'un véhicule tokenisé (NFT) ainsi que les scénarios
d'erreur associés.

------------------------------------------------------------------------

# 1. Déploiement

## Objectif

Vérifier que le contrat est correctement initialisé.

### Test : Should deploy with the correct configuration

-   Vérifie les adresses du vendeur, de l'acheteur et de
    l'intermédiaire.
-   Vérifie les références des contrats ERC20 et VehicleNFT.
-   Vérifie les montants (prix, dépôt, récupération, annulation).
-   Vérifie que tous les états, indicateurs et délais sont initialisés à
    leur valeur par défaut.

------------------------------------------------------------------------

# 2. Dépôt des actifs

## Objectif

Valider le dépôt des fonds et du NFT.

### Tests

-   **Should allow the buyer to fund the escrow**
    -   Vérifie le transfert du prix du véhicule et des frais
        d'annulation.
    -   Vérifie l'événement `VehiclePriceDeposited`.
-   **Should allow the seller to deposit the NFT and cancellation fee**
    -   Vérifie le dépôt du NFT et des frais d'annulation.
    -   Vérifie l'événement `VehicleNFTDeposited`.
-   **Should reach AssetsDeposited when both assets are deposited**
    -   Vérifie la transition vers l'état `AssetsDeposited`.
-   **Should reject asset deposits from unauthorized accounts**
    -   Vérifie les contrôles d'accès.
-   **Should reject asset deposits in invalid states**
    -   Vérifie qu'un dépôt ne peut être effectué deux fois.

------------------------------------------------------------------------

# 3. Dépôt physique du véhicule

## Objectif

Valider la remise physique du véhicule à l'intermédiaire.

### Tests

-   Demande de dépôt.
-   Confirmation du dépôt.
-   Paiement des frais de dépôt.
-   Activation du délai de soumission du code.
-   Rejet des demandes invalides.

------------------------------------------------------------------------

# 4. Soumission du code de cession

## Objectif

Valider la soumission du code chiffré.

### Tests

-   Soumission correcte.
-   Vérification des données enregistrées.
-   Activation du délai de confirmation.
-   Rejet d'un code vide.
-   Rejet d'un hash invalide.
-   Rejet d'une double soumission.
-   Rejet après expiration du délai.

------------------------------------------------------------------------

# 5. Vente normale

## Objectif

Valider le scénario nominal.

### Tests

-   Confirmation du code par l'acheteur.
-   Transfert du prix au vendeur.
-   Transfert du NFT à l'acheteur.
-   Remboursement des frais d'annulation.
-   Expiration du délai de confirmation.

------------------------------------------------------------------------

# 6. Retrait du véhicule

## Objectif

Valider la remise physique du véhicule.

### Tests

-   Demande de retrait.
-   Confirmation par l'intermédiaire.
-   Paiement des frais de retrait.
-   Burn du NFT.
-   Rejet des demandes invalides.

------------------------------------------------------------------------

# 7. Rejet du code

## Objectif

Créer un litige.

### Tests

-   Rejet du code.
-   Création d'un litige `CodeRejected`.
-   Activation du délai de demande de vérification.
-   Rejet après expiration du délai.

------------------------------------------------------------------------

# 8. Vérification après rejet

## Objectif

Résoudre un litige.

### Tests

-   Rejet d'un hash incorrect.
-   Expiration de la demande de vérification.
-   Demande de vérification par le vendeur.
-   Validation du code original.
-   Validation d'un code corrigé.
-   Annulation si aucun code valide.
-   Rejet d'une résolution sans demande préalable.

------------------------------------------------------------------------

# 9. Absence de réponse de l'acheteur

## Objectif

Traiter le cas où l'acheteur ne confirme pas.

### Tests

-   Demande de vérification après expiration.
-   Rejet d'une demande trop tôt.
-   Rejet après expiration de la période.
-   Répartition équitable des frais d'annulation après validation d'un
    code corrigé.

------------------------------------------------------------------------

# 10. Annulation

## Objectif

Valider toutes les procédures d'annulation.

### Tests

-   Annulation avant dépôt physique.
-   Annulation par vendeur ou acheteur.
-   Remboursement des fonds.
-   Burn du NFT.
-   Annulation après expiration du délai de soumission.
-   Annulation après expiration des délais de confirmation.
-   Annulation après absence de demande de vérification.
-   Vérification des états et soldes.
-   Rejet des appels non autorisés.

------------------------------------------------------------------------

# 11. Récupération du véhicule

## Objectif

Valider la restitution du véhicule au vendeur.

### Tests

-   Demande de récupération.
-   Confirmation par l'intermédiaire.
-   Paiement des frais d'annulation.
-   Burn du NFT.
-   Rejet d'une confirmation sans demande préalable.

------------------------------------------------------------------------

# Conclusion

Cette suite couvre :

-   le déploiement ;
-   le dépôt des actifs ;
-   le dépôt physique ;
-   la soumission et la validation du code de cession ;
-   les litiges ;
-   les expirations de délais ;
-   les remboursements ;
-   les annulations ;
-   la récupération du véhicule ;
-   les contrôles d'accès ;
-   les transitions d'état ;
-   les événements émis ;
-   les transferts ERC20 ;
-   les transferts et destructions du NFT.

L'ensemble constitue une couverture complète du workflow principal ainsi
que des principaux scénarios d'erreur et de sécurité.
