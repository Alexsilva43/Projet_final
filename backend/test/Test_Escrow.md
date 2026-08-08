# Test_Escrow.md

# Documentation des tests -- VehicleSaleEscrow

## Introduction

Ce document décrit les tests unitaires du contrat **VehicleSaleEscrow** et explique précisément ce que chaque groupe de tests cherche à valider.

La suite couvre le scénario nominal, les transitions d'état, les transferts ERC20, la gestion du NFT, les délais, les litiges, les annulations et les contrôles d'accès.

---

# 1. Déploiement

## Objectif

Vérifier que le contrat est correctement configuré dès sa création et qu'aucune étape du workflow n'est considérée comme déjà réalisée.

### Test : `Should deploy with the correct configuration`

Ce test vérifie :

- les adresses du vendeur, de l'acheteur et de l'intermédiaire ;
- les références des contrats ERC20 et `VehicleNFT` ;
- l'identifiant du NFT ;
- le prix du véhicule ;
- les frais de dépôt, de récupération et d'annulation ;
- l'état initial `Created` ;
- l'absence de litige ;
- l'absence de demandes de dépôt, de récupération ou de vérification ;
- l'absence de fonds ou de NFT considérés comme déjà déposés ;
- l'inactivité de tous les délais.

---

# 2. Dépôt des actifs

## Objectif

Vérifier le dépôt des actifs nécessaires au démarrage de la vente.

### Test : `Should allow the buyer to fund the escrow`

Vérifie que l'acheteur peut déposer le prix du véhicule et ses frais d'annulation. Le test contrôle le solde de l'acheteur, le solde de l'escrow, l'événement `VehiclePriceDeposited`, l'indicateur de financement et la transition vers `Funded`.

### Test : `Should allow the seller to deposit the NFT and cancellation fee`

Vérifie que le vendeur peut déposer ses frais d'annulation et transférer le NFT à l'escrow. Le test contrôle la propriété du NFT, le solde ERC20 de l'escrow, l'événement `VehicleNFTDeposited`, l'indicateur de dépôt du NFT et la transition vers `NFTDeposited`.

### Test : `Should reach AssetsDeposited when both assets are deposited`

Vérifie que lorsque les dépôts de l'acheteur et du vendeur sont tous les deux réalisés, l'état devient `AssetsDeposited` et que l'escrow détient le prix du véhicule ainsi que les deux montants de `cancellationFee`.

### Test : `Should reject asset deposits from unauthorized accounts`

Vérifie qu'une adresse extérieure à la vente ne peut ni financer la vente à la place de l'acheteur ni déposer le NFT à la place du vendeur. L'état et le solde de l'escrow doivent rester inchangés.

### Test : `Should reject asset deposits in invalid states`

Vérifie qu'un financement ou un dépôt de NFT ne peut pas être effectué une seconde fois une fois l'état `AssetsDeposited` atteint.

---

# 3. Dépôt physique du véhicule

## Objectif

Vérifier la transition entre les dépôts numériques et la prise en charge physique du véhicule par l'intermédiaire.

### Test : `Should request and confirm the vehicle deposit`

Le test couvre les deux étapes :

- le vendeur demande le dépôt et verse `depositFee` ;
- l'intermédiaire confirme la réception du véhicule.

Il vérifie l'émission des événements, le transfert des frais de dépôt vers l'intermédiaire, la transition vers `Ready`, la réinitialisation de la demande de dépôt et l'activation du délai de transmission du code.

### Test : `Should reject invalid deposit requests and confirmations`

Vérifie qu'il est impossible :

- de demander le dépôt avant que les actifs soient déposés ;
- de confirmer un dépôt qui n'a pas été demandé ;
- d'effectuer deux demandes de dépôt successives.

---

# 4. Soumission du code de cession

## Objectif

Vérifier la transmission du code de cession chiffré et l'ouverture du délai de réponse de l'acheteur.

### Test : `Should submit the encrypted code and start the confirmation deadline`

Vérifie l'enregistrement du code chiffré et de son hash, l'émission de `EncryptedTransferCodeSubmitted`, la transition `Ready -> Submitted`, la fermeture du délai de transmission du vendeur et l'ouverture du délai de confirmation de l'acheteur.

### Test : `Should reject an invalid or duplicate transfer code`

Vérifie le rejet :

- d'un code chiffré vide ;
- d'un hash nul ;
- d'une seconde soumission après qu'un code a déjà été enregistré.

### Test : `Should reject submission after the deadline`

Vérifie que le vendeur ne peut plus transmettre le code après expiration du délai prévu.

---

# 5. Vente normale

## Objectif

Valider le scénario dans lequel l'acheteur confirme directement le code, sans litige.

### Test : `Should complete the sale when the buyer confirms the code`

Vérifie l'émission de `SaleConfirmed`, la transition vers `SaleConfirmed`, la désactivation du délai de confirmation et la mise à jour des indicateurs indiquant que les fonds et le NFT ne sont plus détenus par l'escrow.

### Test : `Should transfer the price to the seller and the NFT to the buyer`

Vérifie que le vendeur reçoit le prix du véhicule avec le remboursement de ses frais d'annulation et que le NFT est transféré à l'acheteur.

### Test : `Should refund both cancellation fees`

Vérifie que, dans le scénario nominal, les frais d'annulation des deux parties sont remboursés et que l'escrow ne conserve plus de fonds.

### Test : `Should reject confirmation after the deadline`

Vérifie que l'acheteur ne peut plus confirmer après expiration du délai. Le contrat reste en `Submitted` et le NFT reste dans l'escrow.

---

# 6. Récupération du véhicule par l'acheteur

## Objectif

Vérifier la dernière étape d'une vente réussie : la remise physique du véhicule.

### Test : `Should request and confirm vehicle pickup`

Vérifie que :

- l'acheteur peut demander la récupération et déposer `pickupFee` ;
- l'intermédiaire peut confirmer la remise ;
- `pickupFee` est transféré à l'intermédiaire ;
- l'état devient `Completed` ;
- la demande est réinitialisée ;
- le NFT est détruit ;
- l'escrow ne conserve plus de fonds.

### Test : `Should reject invalid pickup actions`

Vérifie notamment :

- qu'une demande ne peut pas être faite avant `SaleConfirmed` ;
- qu'une adresse non autorisée ne peut pas demander la récupération ;
- qu'une confirmation n'est pas possible sans demande préalable ;
- qu'une double demande est rejetée ;
- que seul l'intermédiaire peut confirmer la remise.

---

# 7. Rejet du code

## Objectif

Vérifier l'ouverture d'un litige lorsque l'acheteur rejette explicitement le code.

### Test : `Should reject the code and create a CodeRejected dispute`

Vérifie que le rejet :

- émet `TransferCodeRejected` ;
- fait passer `Submitted -> Disputed` ;
- enregistre `CodeRejected` ;
- ferme le délai de confirmation ;
- ouvre la période de demande de vérification ;
- laisse le NFT dans l'escrow.

### Test : `Should reject code rejection after the buyer deadline`

Vérifie qu'un rejet effectué après expiration du délai est refusé et qu'aucun litige n'est créé.

---

# 8. Vérification après rejet

## Objectif

Vérifier les différents résultats possibles lorsqu'un litige fait suite au rejet du code par l'acheteur.

### Test : `Should reject an incorrect original transfer-code hash`

Vérifie que l'intermédiaire ne peut pas valider le code initial avec un hash différent de celui enregistré. Le litige reste actif et le NFT reste dans l'escrow.

### Test : `Should reject verification request after the CodeRejected deadline`

Vérifie que le vendeur ne peut plus demander une vérification après expiration de la période prévue.

### Test : `Should allow the seller to request verification`

Vérifie l'émission de `TransferCodeVerificationRequested`, l'activation de la demande et le maintien de l'état `Disputed`.

### Test : `Should complete the sale when the original code is valid`

Vérifie qu'après validation du code initial :

- le litige est résolu ;
- l'état devient `SaleConfirmed` ;
- le NFT est transféré à l'acheteur ;
- le vendeur reçoit le prix et récupère ses frais d'annulation ;
- l'intermédiaire reçoit les frais prévus ;
- l'acheteur ne récupère pas son `cancellationFee`.

### Test : `Should complete the sale when a corrected code is valid`

Vérifie qu'après validation d'un code corrigé :

- le nouveau code et le nouveau hash remplacent les précédents ;
- l'événement `TransferCodeCorrected` est émis ;
- la vente est confirmée ;
- le vendeur reçoit le prix ;
- l'acheteur récupère ses frais d'annulation ;
- l'intermédiaire reçoit les frais prévus.

### Test : `Should cancel the sale when no valid code exists`

Vérifie que lorsqu'aucun code valide n'existe :

- la vente passe à `Cancelled` ;
- le litige est réinitialisé ;
- le NFT retourne au vendeur ;
- l'acheteur récupère le prix et ses frais d'annulation ;
- la récupération physique du véhicule devient nécessaire ;
- un `cancellationFee` reste dans l'escrow pour la récupération.

### Test : `Should reject dispute resolution before verification is requested`

Vérifie que l'intermédiaire ne peut pas résoudre un litige tant que le vendeur n'a pas officiellement demandé la vérification.

---

# 9. Absence de réponse de l'acheteur

## Objectif

Vérifier le cas où l'acheteur ne confirme ni ne rejette le code avant l'expiration de son délai.

À l'expiration de ce délai, une période de demande de vérification débute pour le vendeur.

### Test : `Should allow the seller to request verification after buyer timeout`

Vérifie que le vendeur peut demander une vérification après l'expiration du délai de l'acheteur. Le test contrôle les événements `TransferCodeVerificationRequested` et `BuyerDidNotConfirm`, la transition vers `Disputed` et l'enregistrement de `BuyerDidNotRespond`.

### Test : `Should reject verification requests too early or too late`

Vérifie les deux limites temporelles :

- avant la fin du délai de confirmation, la demande est trop précoce ;
- après la fin de la période de demande de vérification, elle est trop tardive.

Dans les deux cas, aucun litige ne doit être ouvert.

### Test : `Should split the remaining cancellation fee correctly after buyer timeout`

Vérifie la répartition financière lorsqu'un code corrigé est validé après absence de réponse de l'acheteur.

Le test contrôle que :

- le vendeur reçoit le prix et une partie du montant restant ;
- l'acheteur reçoit l'autre partie ;
- l'intermédiaire reçoit `depositFee + cancellationFee` ;
- l'escrow ne conserve aucun fonds ;
- le NFT est transféré à l'acheteur ;
- l'état devient `SaleConfirmed`.

---

# 10. Annulation

## Objectif

Vérifier les différents scénarios d'annulation avant et après le dépôt physique du véhicule.

### Test : `Should allow the buyer to cancel before the physical vehicle deposit is requested`

Vérifie qu'une annulation anticipée peut être demandée par l'acheteur et qu'elle entraîne la transition vers `Cancelled`.

### Test : `Should allow the seller to cancel before the physical vehicle deposit is requested`

Vérifie le même droit d'annulation anticipée pour le vendeur.

### Test : `Should refund deposited funds and burn the NFT during early cancellation`

Vérifie le cas où les deux parties ont déjà effectué leurs dépôts :

- l'acheteur récupère le prix et ses frais d'annulation ;
- le vendeur récupère ses frais d'annulation ;
- l'escrow ne conserve plus de fonds ;
- les indicateurs de dépôt sont réinitialisés ;
- le NFT détenu par l'escrow est détruit.

### Test : `Should burn the NFT from the seller wallet when cancelled before NFT deposit`

Ce nouveau test couvre le cas où l'acheteur a déjà financé la vente mais où le vendeur n'a pas encore déposé son NFT.

Il vérifie que :

- le NFT appartient encore au vendeur avant l'annulation ;
- l'annulation rembourse intégralement l'acheteur ;
- l'état devient `Cancelled` ;
- le NFT est détruit directement depuis le wallet du vendeur.

Ce test garantit qu'un NFT associé à une vente annulée ne reste pas bloqué chez le vendeur lorsqu'il n'avait pas encore été transféré à l'escrow.

### Test : `Should reject cancellation before the transfer code deadline expires`

Vérifie qu'une annulation pour absence de code n'est pas possible tant que le délai de transmission du vendeur est encore actif.

### Test : `Should cancel after the transfer code deadline`

Vérifie l'annulation lorsque le vendeur ne transmet pas le code à temps :

- passage à `Cancelled` ;
- retour du NFT au vendeur ;
- remboursement du prix et du `cancellationFee` à l'acheteur ;
- maintien d'un `cancellationFee` dans l'escrow ;
- récupération physique du véhicule requise.

### Test : `Should reject cancellation during the verification-request period after buyer timeout`

Vérifie qu'une annulation n'est pas possible pendant la période où le vendeur peut encore demander une vérification après absence de réponse de l'acheteur.

### Test : `Should cancel when the buyer and verification deadlines expire`

Vérifie l'annulation lorsqu'aucune réponse ni demande de vérification n'a été effectuée dans les délais.

Le test contrôle le retour du NFT au vendeur, le remboursement du prix à l'acheteur, le remboursement d'un `cancellationFee` au vendeur, le maintien de l'autre dans l'escrow et l'obligation de récupérer le véhicule.

### Test : `Should reject cancellation during the verification-request period after code rejection`

Vérifie que l'annulation n'est pas possible tant que le vendeur dispose encore du délai prévu pour demander une vérification après rejet.

### Test : `Should cancel when verification is not requested after code rejection`

Vérifie qu'après expiration de cette période :

- la vente passe à `Cancelled` ;
- le litige est réinitialisé ;
- l'acheteur récupère le prix et ses frais d'annulation ;
- le NFT retourne au vendeur ;
- un `cancellationFee` reste dans l'escrow ;
- la récupération du véhicule devient nécessaire.

### Test : `Should reject cancellation from unauthorized accounts or invalid states`

Vérifie qu'une adresse extérieure ne peut pas annuler la vente et que l'annulation anticipée n'est plus disponible une fois l'état `Ready` atteint.

---

# 11. Récupération du véhicule après annulation

## Objectif

Vérifier la restitution du véhicule au vendeur lorsqu'une vente est annulée après son dépôt physique.

### Test : `Should request and confirm vehicle recovery after cancellation`

Le test provoque d'abord une annulation après expiration du délai de transmission du code.

Il vérifie ensuite que :

- la récupération du véhicule est requise ;
- le NFT a été retourné au vendeur ;
- le vendeur peut demander la récupération ;
- l'intermédiaire peut confirmer la restitution ;
- les indicateurs de récupération sont réinitialisés ;
- les frais d'annulation restants sont transférés à l'intermédiaire ;
- l'escrow ne conserve plus de fonds ;
- le NFT est définitivement détruit.

### Test : `Should reject recovery confirmation when recovery was not requested`

Vérifie que l'intermédiaire ne peut pas confirmer la récupération du véhicule tant que le vendeur n'a pas effectué la demande correspondante.

---

# Conclusion

La suite de tests couvre l'ensemble du cycle de vie de `VehicleSaleEscrow` :

- configuration initiale ;
- dépôt des actifs ;
- dépôt physique du véhicule ;
- transmission du code de cession ;
- vente nominale ;
- remise du véhicule à l'acheteur ;
- rejet du code ;
- résolution des litiges ;
- absence de réponse de l'acheteur ;
- scénarios d'annulation ;
- récupération du véhicule par le vendeur ;
- transferts ERC20 ;
- transferts et destruction du NFT ;
- transitions d'état ;
- événements ;
- contrôles d'accès ;
- limites temporelles.

Le nouveau test d'annulation avant dépôt du NFT complète la couverture en vérifiant que le NFT est détruit même lorsqu'il est encore détenu par le vendeur au moment de l'annulation.
