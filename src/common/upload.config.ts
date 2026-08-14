import { copyFile, rename, unlink, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Taille maximale acceptée par fichier uploadé (en Mo).
 *
 * Une vidéo filmée au téléphone pèse facilement 100 à 400 Mo par minute selon
 * la définition (1080p60, 4K…). L'ancienne limite de 100 Mo faisait rejeter par
 * multer toute vidéo d'environ une minute, et NestJS traduit cette erreur
 * (`LIMIT_FILE_SIZE`) en HTTP 413 Payload Too Large côté client.
 *
 * Note : lue à l'import du module, donc avant que ConfigModule ne charge le
 * fichier `.env.*`. Pour surcharger la valeur, il faut une vraie variable
 * d'environnement du process (shell, systemd, panneau d'hébergement).
 */
export const MAX_UPLOAD_SIZE_MB = Number(process.env.MAX_UPLOAD_SIZE_MB) || 1024;

/** Nombre maximum de fichiers par requête. */
export const MAX_UPLOAD_FILES = 20;

/** Dossier tampon où multer écrit les fichiers avant leur classement définitif. */
export const TMP_UPLOAD_DIR = join(process.cwd(), 'uploads', 'tmp');

/**
 * Options multer partagées par tous les endpoints d'upload.
 *
 * `dest` fait écrire multer directement sur disque, en flux, au lieu de garder
 * chaque fichier entier en mémoire (comportement par défaut). Sans ça, monter
 * la limite reviendrait à charger plusieurs centaines de Mo dans le heap Node
 * pour un seul upload.
 */
export const mediaUploadOptions = {
  dest: TMP_UPLOAD_DIR,
  limits: {
    fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    files: MAX_UPLOAD_FILES,
  },
};

/**
 * Déplace un fichier uploadé vers son emplacement définitif.
 *
 * Avec le stockage disque, multer fournit `file.path` : un simple `rename` suffit
 * (instantané, aucune copie en mémoire). Le repli sur `file.buffer` garde la
 * compatibilité si un endpoint utilise encore le stockage mémoire.
 */
export async function persistUploadedFile(
  file: Express.Multer.File,
  destination: string,
): Promise<void> {
  if (file.path) {
    try {
      await rename(file.path, destination);
    } catch (error: any) {
      // rename échoue entre deux systèmes de fichiers (dossier uploads monté
      // sur un autre volume) — on retombe sur copie + suppression.
      if (error?.code !== 'EXDEV') throw error;
      await copyFile(file.path, destination);
      await unlink(file.path);
    }
    return;
  }

  await writeFile(destination, file.buffer);
}

/**
 * Supprime les fichiers tampon encore présents (upload interrompu, transaction
 * en échec…). Sans effet sur ceux déjà déplacés par `persistUploadedFile`.
 */
export async function cleanupTempUploads(
  files?: Express.Multer.File[],
): Promise<void> {
  if (!files?.length) return;

  await Promise.all(
    files.map(async (file) => {
      if (!file?.path) return;
      try {
        await unlink(file.path);
      } catch {
        // déjà déplacé ou déjà supprimé
      }
    }),
  );
}
