/**
 * Google Drive Service für Kundenakte
 * Verwaltet Dateien in Google Drive unter: Fabrica ERP/Kunden/[Kundenname]/[Projektname]/
 */
import { google } from 'googleapis';
import { Readable } from 'stream';

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET!;
const REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN!;

const ROOT_FOLDER_NAME = 'Fabrica ERP';
const CUSTOMERS_FOLDER_NAME = 'Kunden';
const SUPPLIERS_FOLDER_NAME = 'Lieferanten';

function getAuthClient() {
  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  auth.setCredentials({ refresh_token: REFRESH_TOKEN });
  return auth;
}

function getDriveClient() {
  return google.drive({ version: 'v3', auth: getAuthClient() });
}

/**
 * Findet oder erstellt einen Ordner mit gegebenem Namen unter einem Parent
 */
async function findOrCreateFolder(drive: ReturnType<typeof getDriveClient>, name: string, parentId?: string): Promise<string> {
  // Sonderzeichen im Ordnernamen für die Query escapen
  const safeName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const query = parentId
    ? `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  // Ordner erstellen
  const folderMeta: any = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    folderMeta.parents = [parentId];
  }

  const folder = await drive.files.create({
    requestBody: folderMeta,
    fields: 'id',
  });

  return folder.data.id!;
}

/**
 * Gibt die Folder-ID für einen Kunden zurück (erstellt Ordner wenn nötig)
 * Struktur: Fabrica ERP/Kunden/[Kundenname]/
 */
export async function getOrCreateCustomerFolder(customerName: string): Promise<string> {
  const drive = getDriveClient();

  // Root-Ordner: "Fabrica ERP"
  const rootId = await findOrCreateFolder(drive, ROOT_FOLDER_NAME);

  // Kunden-Ordner: "Fabrica ERP/Kunden"
  const customersId = await findOrCreateFolder(drive, CUSTOMERS_FOLDER_NAME, rootId);

  // Kunden-spezifischer Ordner: "Fabrica ERP/Kunden/[Name]"
  const customerFolderId = await findOrCreateFolder(drive, customerName, customersId);

  return customerFolderId;
}

/**
 * Gibt die Folder-ID für einen Lieferanten zurück (erstellt Ordner wenn nötig)
 * Struktur: Fabrica ERP/Lieferanten/[Lieferantenname]/
 */
export async function getOrCreateSupplierFolder(supplierName: string): Promise<string> {
  const drive = getDriveClient();

  // Root-Ordner: "Fabrica ERP"
  const rootId = await findOrCreateFolder(drive, ROOT_FOLDER_NAME);

  // Lieferanten-Ordner: "Fabrica ERP/Lieferanten"
  const suppliersId = await findOrCreateFolder(drive, SUPPLIERS_FOLDER_NAME, rootId);

  // Lieferanten-spezifischer Ordner: "Fabrica ERP/Lieferanten/[Name]"
  const supplierFolderId = await findOrCreateFolder(drive, supplierName, suppliersId);

  return supplierFolderId;
}

/**
 * Gibt die Web-URL des Projektordners auf Google Drive zurück.
 * Erstellt den Ordner falls er noch nicht existiert.
 */
export async function getProjectDriveFolderUrl(customerName: string, projectName: string): Promise<string> {
  const folderId = await getOrCreateProjectFolder(customerName, projectName);
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export async function getOrCreateProjectFolder(customerName: string, projectName: string): Promise<string> {
  const drive = getDriveClient();

  // Root-Ordner: "Fabrica ERP"
  const rootId = await findOrCreateFolder(drive, ROOT_FOLDER_NAME);

  // Kunden-Ordner: "Fabrica ERP/Kunden"
  const customersId = await findOrCreateFolder(drive, CUSTOMERS_FOLDER_NAME, rootId);

  // Kunden-spezifischer Ordner: "Fabrica ERP/Kunden/[Kundenname]"
  const customerFolderId = await findOrCreateFolder(drive, customerName, customersId);

  // Projekt-Unterordner: "Fabrica ERP/Kunden/[Kundenname]/[Projektname]"
  const projectFolderId = await findOrCreateFolder(drive, projectName, customerFolderId);

  return projectFolderId;
}

/**
 * Datei in Google Drive hochladen
 */
export async function uploadFileToDrive(params: {
  filename: string;
  mimeType: string;
  buffer: Buffer;
  customerName: string;
  projectName?: string; // Optional: wenn angegeben, wird Projekt-Unterordner verwendet
  folderId?: string;
}): Promise<{ fileId: string; fileUrl: string; webViewLink: string }> {
  const drive = getDriveClient();

  let folderId: string;
  if (params.folderId) {
    folderId = params.folderId;
  } else if (params.projectName) {
    folderId = await getOrCreateProjectFolder(params.customerName, params.projectName);
  } else {
    folderId = await getOrCreateCustomerFolder(params.customerName);
  }

  const stream = new Readable();
  stream.push(params.buffer);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: params.filename,
      parents: [folderId],
    },
    media: {
      mimeType: params.mimeType,
      body: stream,
    },
    fields: 'id, webViewLink, webContentLink',
  });

  const fileId = res.data.id!;
  const webViewLink = res.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

  // Datei öffentlich lesbar machen (nur für Inhaber des Links)
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  return {
    fileId,
    fileUrl: `https://drive.google.com/file/d/${fileId}/view`,
    webViewLink,
  };
}

/**
 * Datei aus Google Drive löschen
 */
export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.files.delete({ fileId });
}

/**
 * Download-URL für eine Datei generieren (direkter Download)
 */
export async function getDownloadUrl(fileId: string): Promise<string> {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Alle Dateien eines Kunden-Ordners auflisten (für Backup-Zwecke)
 */
export async function listCustomerFolderFiles(customerName: string): Promise<Array<{
  id: string;
  name: string;
  size: string;
  mimeType: string;
  webViewLink: string;
}>> {
  const drive = getDriveClient();
  const folderId = await getOrCreateCustomerFolder(customerName);

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, size, mimeType, webViewLink)',
    spaces: 'drive',
  });

  return (res.data.files || []).map(f => ({
    id: f.id!,
    name: f.name!,
    size: f.size || '0',
    mimeType: f.mimeType!,
    webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
  }));
}

/**
 * Verschiebt eine Datei in einen anderen Ordner in Google Drive.
 * Gibt true zurück wenn verschoben, false wenn bereits im Zielordner.
 */
export async function moveFileToDriveFolder(fileId: string, newFolderId: string): Promise<boolean> {
  const drive = getDriveClient();

  // Aktuelle Parent-Ordner der Datei ermitteln
  const file = await drive.files.get({
    fileId,
    fields: 'parents',
  });

  const currentParents = file.data.parents || [];

  // Bereits im Zielordner? Dann nichts tun
  if (currentParents.includes(newFolderId)) {
    return false;
  }

  const previousParents = currentParents.join(',');

  // Datei in neuen Ordner verschieben
  await drive.files.update({
    fileId,
    addParents: newFolderId,
    removeParents: previousParents || undefined,
    fields: 'id, parents',
  });

  return true;
}

/**
 * Listet alle Dateien direkt im Kunden-Ordner auf (nicht in Unterordnern)
 * Wird für die Migration verwendet
 */
export async function listFilesInCustomerRootFolder(customerName: string): Promise<Array<{
  id: string;
  name: string;
  mimeType: string;
}>> {
  const drive = getDriveClient();
  const folderId = await getOrCreateCustomerFolder(customerName);

  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name, mimeType)',
    spaces: 'drive',
  });

  return (res.data.files || []).map(f => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
  }));
}

/**
 * Listet ALLE Dateien im Fabrica ERP Ordner auf (rekursiv, alle Unterordner)
 * Wird für die vollständige Migration verwendet
 */
export async function listAllFilesInFabricaERP(): Promise<Array<{
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
}>> {
  const drive = getDriveClient();

  // Root-Ordner finden
  const rootId = await findOrCreateFolder(drive, ROOT_FOLDER_NAME);

  // Alle Dateien (keine Ordner) im gesamten Fabrica ERP Ordner rekursiv suchen
  const allFiles: Array<{ id: string; name: string; mimeType: string; parents: string[] }> = [];
  let pageToken: string | undefined;

  do {
    const res: any = await drive.files.list({
      q: `'${rootId}' in parents or mimeType!='application/vnd.google-apps.folder'`,
      fields: 'nextPageToken, files(id, name, mimeType, parents)',
      spaces: 'drive',
      pageSize: 1000,
      pageToken,
    });

    // Alle Dateien die NICHT Ordner sind und irgendwo unter Fabrica ERP liegen
    const files = (res.data.files || []).filter((f: any) => f.mimeType !== 'application/vnd.google-apps.folder');
    allFiles.push(...files.map((f: any) => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      parents: f.parents || [],
    })));
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return allFiles;
}

/**
 * Sucht alle Dateien direkt im Kunden-Root-Ordner (nicht in Unterordnern)
 * und gibt sie mit ihrer Drive-ID zurück
 */
export async function listAllFilesInKundenFolder(): Promise<Array<{
  id: string;
  name: string;
  mimeType: string;
  customerFolderId: string;
  customerName: string;
}>> {
  const drive = getDriveClient();

  // Kunden-Ordner finden
  const rootId = await findOrCreateFolder(drive, ROOT_FOLDER_NAME);
  const customersId = await findOrCreateFolder(drive, CUSTOMERS_FOLDER_NAME, rootId);

  // Alle Kunden-Unterordner auflisten
  const customerFoldersRes = await drive.files.list({
    q: `'${customersId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  const result: Array<{ id: string; name: string; mimeType: string; customerFolderId: string; customerName: string }> = [];

  for (const customerFolder of (customerFoldersRes.data.files || [])) {
    // Alle Dateien direkt im Kunden-Ordner (nicht in Unterordnern)
    const filesRes = await drive.files.list({
      q: `'${customerFolder.id}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, mimeType)',
      spaces: 'drive',
    });

    for (const file of (filesRes.data.files || [])) {
      result.push({
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
        customerFolderId: customerFolder.id!,
        customerName: customerFolder.name!,
      });
    }
  }

  return result;
}

/**
 * Benennt einen Ordner in Google Drive um.
 * Sucht den Projektordner anhand von Kundenname + altem Projektnamen und benennt ihn um.
 * Gibt true zurück wenn umbenannt, false wenn Ordner nicht gefunden.
 */
export async function renameDriveProjectFolder(
  customerName: string,
  oldProjectName: string,
  newProjectName: string
): Promise<boolean> {
  if (oldProjectName === newProjectName) return false;
  const drive = getDriveClient();

  // Kunden-Ordner finden (nicht erstellen – wenn er nicht existiert, gibt es nichts umzubenennen)
  const rootId = await findOrCreateFolder(drive, ROOT_FOLDER_NAME);
  const customersId = await findOrCreateFolder(drive, CUSTOMERS_FOLDER_NAME, rootId);
  const safeCustomer = customerName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const customerRes = await drive.files.list({
    q: `name='${safeCustomer}' and mimeType='application/vnd.google-apps.folder' and '${customersId}' in parents and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  if (!customerRes.data.files || customerRes.data.files.length === 0) return false;
  const customerFolderId = customerRes.data.files[0].id!;

  // Projektordner mit altem Namen suchen
  const safeOld = oldProjectName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const projectRes = await drive.files.list({
    q: `name='${safeOld}' and mimeType='application/vnd.google-apps.folder' and '${customerFolderId}' in parents and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  if (!projectRes.data.files || projectRes.data.files.length === 0) return false;
  const projectFolderId = projectRes.data.files[0].id!;

  // Ordner umbenennen
  await drive.files.update({
    fileId: projectFolderId,
    requestBody: { name: newProjectName },
    fields: 'id, name',
  });

  return true;
}

/**
 * Prüft ob die Google Drive Verbindung funktioniert
 */
export async function testDriveConnection(): Promise<{ ok: boolean; connected?: boolean; email?: string; storageUsed?: string; error?: string }> {
  try {
    const drive = getDriveClient();
    const about = await drive.about.get({ fields: 'user,storageQuota' });
    const quota = about.data.storageQuota;
    let storageUsed: string | undefined;
    if (quota?.usage && quota?.limit) {
      const usedGB = (parseInt(quota.usage) / 1024 / 1024 / 1024).toFixed(1);
      const totalGB = Math.round(parseInt(quota.limit) / 1024 / 1024 / 1024);
      storageUsed = `${usedGB} GB / ${totalGB >= 1000 ? (totalGB / 1024).toFixed(0) + ' TB' : totalGB + ' GB'}`;
    }
    return { ok: true, connected: true, email: about.data.user?.emailAddress || undefined, storageUsed };
  } catch (err: any) {
    return { ok: false, connected: false, error: err.message };
  }
}
