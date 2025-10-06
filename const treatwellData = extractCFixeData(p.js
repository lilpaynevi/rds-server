const treatwellData = extractCFixeData(plainBody);

        // 📅 Conversion de la date si nécessaire
        if (treatwellData.dateRendezVous) {
          const isoDate = convertFrenchDateTreatWell(treatwellData.dateRendezVous);
          treatwellData.dateRendezVous = isoDate
        }

        console.log(`⏰ DURÉE EXACTE: ${treatwellData.dureeTotal} minutes`);
        console.log(`📋 PRESTATIONS:`, treatwellData.prestations);

        // 🚀 Créer le time-block
        
const payload = await createTreatwellTimeBlock(treatwellData);

        if (payload) {
          try {
            const response = await sendToFreshaAPI(payload);

            if (response.success) {
              console.log('✅ Réservation créée avec succès:', response.data);

              // 📧 Marquer le message comme lu après succès
              message.markRead()

              // 🏷️ Optionnel: ajouter le label "traité"
              const label = GmailApp.getUserLabelByName(LABEL_PROCESSED) || GmailApp.createLabel(LABEL_PROCESSED);
              thread.addLabel(label);

            }
            return response;
          } catch (error) {
            console.error('❌ Erreur lors de l\'envoi:', error);
            return { success: false, error: error.message };
          }
        }