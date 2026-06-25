// ==========================================
// KONFIGURACJA BAZY DANYCH
// ==========================================
const DB_ID = '';
const PRAC_CSV_ID = '';

function getDB() { return SpreadsheetApp.openById(DB_ID); }

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('System Szafek').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getUserAccess() {
  const email = Session.getActiveUser().getEmail();
  const data = getDB().getSheetByName('Uprawnienia').getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase().trim() === email.toLowerCase().trim()) {
      return { email: email, dzial: data[i][1].toString().trim(), role: data[i][2].toString().trim().toLowerCase(), authorized: true };
    }
  }
  return { email: email, dzial: '', role: '', authorized: false };
}

function getSzafkiData() {
  const access = getUserAccess();
  if (!access.authorized) return { success: false, message: 'Brak uprawnień.', data: [] };
  
  const db = getDB();
  const data = db.getSheetByName('Szafki').getDataRange().getDisplayValues();
  if (data.length <= 1) return { success: true, access: access, data: [] };
  
  const pData = db.getSheetByName('Pracownicy').getDataRange().getDisplayValues();
  const pHeaders = pData[0] || [];
  const pKodIdx = pHeaders.indexOf('Kod');
  const pZatrIdx = pHeaders.indexOf('Zatrudniony'); 
  
  const empZatrMap = {};
  if (pKodIdx > -1 && pZatrIdx > -1) {
     for(let i=1; i<pData.length; i++) {
        if(pData[i][pKodIdx]) empZatrMap[pData[i][pKodIdx].toString()] = pData[i][pZatrIdx];
     }
  }

  const headers = data[0];
  const dzialIdx = headers.indexOf('Dział szafki');
  const kodPracIdx = headers.indexOf('Kod pracownika');
  
  let filteredRows = access.role === 'admin' ? data.slice(1) : data.slice(1).filter(r => r[dzialIdx].trim() === access.dzial);
  
  return { success: true, access: access, data: filteredRows.map(row => {
    let obj = {}; 
    headers.forEach((h, i) => obj[h] = row[i]); 
    let kod = row[kodPracIdx];
    if(kod && empZatrMap[kod] !== undefined) obj['Zatrudniony'] = empZatrMap[kod];
    return obj;
  })};
}

function getPracownicyData() {
  const access = getUserAccess();
  if (!access.authorized) throw new Error("Brak uprawnień");
  const data = getDB().getSheetByName('Pracownicy').getDataRange().getDisplayValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    let obj = {}; headers.forEach((h, i) => obj[h] = row[i]); return obj;
  });
}

function getDictionaries() {
  const sheet = getDB().getSheetByName('Słowniki');
  if(!sheet) return { miejsca: [], dzialy: [], plcie: [] };
  const data = sheet.getDataRange().getValues();
  let dicts = { miejsca: [], dzialy: [], plcie: [] };
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) dicts.miejsca.push(data[i][0].toString().trim());
    if (data[i][1]) dicts.dzialy.push(data[i][1].toString().trim());
    if (data[i][2]) dicts.plcie.push(data[i][2].toString().trim());
  }
  return dicts;
}

function zapiszSzafke(payload) {
  const access = getUserAccess();
  if (!access.authorized) throw new Error('Brak uprawnień');
  const ss = getDB();
  const slownikiSheet = ss.getSheetByName('Słowniki');
  
  let targetDzial = (payload.Dzial || access.dzial).trim();

  if (slownikiSheet) {
    const dictData = slownikiSheet.getDataRange().getValues();
    let miejsca = []; let dzialy = [];
    for(let i=1; i<dictData.length; i++) {
       if(dictData[i][0]) miejsca.push(dictData[i][0].toString().trim().toLowerCase());
       if(dictData[i][1]) dzialy.push(dictData[i][1].toString().trim().toLowerCase());
    }
    if (payload.Miejsce && !miejsca.includes(payload.Miejsce.trim().toLowerCase())) {
       let r = 2; while(r <= dictData.length && dictData[r-1][0]) r++;
       slownikiSheet.getRange(r, 1).setValue(payload.Miejsce.trim());
    }
    if (targetDzial && !dzialy.includes(targetDzial.toLowerCase())) {
       let r = 2; while(r <= dictData.length && dictData[r-1][1]) r++;
       slownikiSheet.getRange(r, 2).setValue(targetDzial);
    }
  }

  const sheet = ss.getSheetByName('Szafki');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  let idSzafki = payload.ID;
  const isNew = !idSzafki;
  const szafkiLista = payload.Szafki; 

  if (!payload.Miejsce || payload.Miejsce.trim() === '') throw new Error('Miejsce jest wymagane!');
  if (szafkiLista.length === 0) throw new Error('Brak szafek do zapisu.');
  if (szafkiLista.length > 50) throw new Error('Maks. 50 szafek naraz.');
  
  let maxNr = 0; let maxId = 0;
  
  for (let i = 1; i < data.length; i++) {
    let rId = parseInt(data[i][headers.indexOf('ID')]);
    if (!isNaN(rId) && rId > maxId) maxId = rId;
    
    let m = data[i][headers.indexOf('Miejsce')];
    let d = data[i][headers.indexOf('Dział szafki')];
    
    if (m && m.toString().trim().toLowerCase() === payload.Miejsce.trim().toLowerCase() &&
        d && d.toString().trim().toLowerCase() === targetDzial.toLowerCase()) {
      let nr = parseInt(data[i][headers.indexOf('Nr szafki')]);
      if (!isNaN(nr) && nr > maxNr) maxNr = nr;
    }
  }
  
  if (isNew) {
    let newRows = [];
    for (let i = 0; i < szafkiLista.length; i++) {
      let sz = szafkiLista[i]; maxId++;
      let szafkaNr = sz.nr.trim();
      if (szafkaNr === '') {
        maxNr++; szafkaNr = maxNr;
      } else {
        for (let r = 1; r < data.length; r++) {
          if (data[r][headers.indexOf('Miejsce')].toString().trim().toLowerCase() === payload.Miejsce.trim().toLowerCase() &&
              data[r][headers.indexOf('Dział szafki')].toString().trim().toLowerCase() === targetDzial.toLowerCase() &&
              data[r][headers.indexOf('Nr szafki')].toString() === szafkaNr) {
             throw new Error(`Szafka nr ${szafkaNr} już istnieje w miejscu: ${payload.Miejsce} (Dział: ${targetDzial})!`);
          }
        }
        let parsed = parseInt(szafkaNr); if (!isNaN(parsed) && parsed > maxNr) maxNr = parsed;
      }
      
      let newRow = new Array(headers.length).fill('');
      newRow[headers.indexOf('ID')] = maxId;
      newRow[headers.indexOf('Miejsce')] = payload.Miejsce.trim();
      newRow[headers.indexOf('Nr szafki')] = szafkaNr;
      newRow[headers.indexOf('Nr zamka')] = sz.zamek.trim();
      newRow[headers.indexOf('Płeć docelowa')] = payload.Plec;
      newRow[headers.indexOf('Dział szafki')] = targetDzial;
      newRow[headers.indexOf('Status')] = payload.Status || 'Wolna';
      newRow[headers.indexOf('Komentarz')] = payload.Komentarz;
      newRows.push(newRow);
    }
    
    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
      zapiszHistorie(0, 'Utworzenie', access.email, `Utworzono ${newRows.length} szafek w miejscu ${payload.Miejsce} (${targetDzial})`);
    }
  } else {
    let szafkaEdit = szafkiLista[0];
    if (!szafkaEdit.nr || szafkaEdit.nr.trim() === '') throw new Error('Wymagany numer!');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][headers.indexOf('ID')].toString() !== idSzafki.toString() &&
          data[i][headers.indexOf('Miejsce')].toString().trim().toLowerCase() === payload.Miejsce.trim().toLowerCase() &&
          data[i][headers.indexOf('Dział szafki')].toString().trim().toLowerCase() === targetDzial.toLowerCase() &&
          data[i][headers.indexOf('Nr szafki')].toString() === szafkaEdit.nr.toString()) {
         throw new Error(`Szafka nr ${szafkaEdit.nr} już istnieje w miejscu: ${payload.Miejsce} (Dział: ${targetDzial})!`);
      }
    }

    const idIdx = headers.indexOf('ID');
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx].toString() === idSzafki.toString()) {
        if (access.role !== 'admin' && data[i][headers.indexOf('Dział szafki')] !== access.dzial) throw new Error('Brak uprawnień do edycji w innym dziale.');
        
        sheet.getRange(i+1, headers.indexOf('Miejsce')+1).setValue(payload.Miejsce);
        sheet.getRange(i+1, headers.indexOf('Nr szafki')+1).setValue(szafkaEdit.nr);
        sheet.getRange(i+1, headers.indexOf('Nr zamka')+1).setValue(szafkaEdit.zamek);
        sheet.getRange(i+1, headers.indexOf('Płeć docelowa')+1).setValue(payload.Plec);
        sheet.getRange(i+1, headers.indexOf('Komentarz')+1).setValue(payload.Komentarz);
        if(access.role === 'admin' && payload.Dzial) sheet.getRange(i+1, headers.indexOf('Dział szafki')+1).setValue(payload.Dzial);
        
        let newStatus = payload.Status;
        sheet.getRange(i+1, headers.indexOf('Status')+1).setValue(newStatus);
        
        if (newStatus === 'Nieczynna') {
          ['Kod pracownika', 'Nazwisko', 'Imię', 'Dział pracownika', 'Stanowisko', 'Płeć', 'Zmiana', 'Zatrudniony'].forEach(col => {
            let colIdx = headers.indexOf(col);
            if (colIdx > -1) sheet.getRange(i + 1, colIdx + 1).setValue('');
          });
        }
        
        zapiszHistorie(idSzafki, 'Edycja', access.email, `Zaktualizowano szafkę`);
        break;
      }
    }
  }
  return { success: true };
}

function usunSzafki(ids) {
  const access = getUserAccess();
  if (!access.authorized) throw new Error('Brak uprawnień');
  const sheet = getDB().getSheetByName('Szafki');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('ID');
  const dzialIdx = headers.indexOf('Dział szafki');

  let rowsToDelete = [];
  for(let i = data.length - 1; i >= 1; i--) {
    if (ids.includes(data[i][idIdx].toString())) {
      if (access.role !== 'admin' && data[i][dzialIdx] !== access.dzial) throw new Error('Brak uprawnień do usunięcia wybranych szafek z innych działów.');
      rowsToDelete.push(i + 1);
    }
  }

  rowsToDelete.forEach(r => sheet.deleteRow(r));
  zapiszHistorie(ids.join(', '), 'Usunięcie', access.email, `Usunięto ${rowsToDelete.length} szafek`);
  return { success: true };
}

function zwolnijSzafke(idSzafki) {
  const access = getUserAccess();
  if (!access.authorized) throw new Error('Brak uprawnień');
  const sheet = getDB().getSheetByName('Szafki');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('ID')].toString() === idSzafki.toString()) {
      if (access.role !== 'admin' && data[i][headers.indexOf('Dział szafki')] !== access.dzial) throw new Error('Brak uprawnień.');
      
      ['Kod pracownika', 'Nazwisko', 'Imię', 'Dział pracownika', 'Stanowisko', 'Płeć', 'Zmiana', 'Zatrudniony'].forEach(col => {
        let colIdx = headers.indexOf(col);
        if (colIdx > -1) sheet.getRange(i + 1, colIdx + 1).setValue('');
      });
      sheet.getRange(i + 1, headers.indexOf('Status') + 1).setValue('Wolna');
      zapiszHistorie(idSzafki, 'Zwolnienie', access.email, `Zwolniono szafkę`);
      return { success: true };
    }
  }
  return { success: false, message: 'Nie znaleziono szafki.' };
}

function przydzielSzafke(idSzafki, kodPracownika) {
  const access = getUserAccess();
  if (!access.authorized) throw new Error('Brak uprawnień');
  
  const ss = getDB();
  const pracownicySheet = ss.getSheetByName('Pracownicy');
  const szafkiSheet = ss.getSheetByName('Szafki');
  
  const pData = pracownicySheet.getDataRange().getValues();
  const pHeaders = pData[0];
  let pracownik = pData.find(r => r[pHeaders.indexOf('Kod')].toString() === kodPracownika.toString());
  
  if(!pracownik) throw new Error('Nie znaleziono pracownika w bazie.');
  
  let zatrudniony = pracownik[pHeaders.indexOf('Zatrudniony')];
  if (zatrudniony === false || zatrudniony === 'FALSE' || zatrudniony === 'False') {
      throw new Error('Ten pracownik jest zwolniony. Nie można przydzielić szafki.');
  }
  
  const sData = szafkiSheet.getDataRange().getValues();
  const sHeaders = sData[0];
  
  for (let i = 1; i < sData.length; i++) {
    if (sData[i][sHeaders.indexOf('ID')].toString() === idSzafki.toString()) {
      if (access.role !== 'admin' && sData[i][sHeaders.indexOf('Dział szafki')] !== access.dzial) throw new Error('Brak uprawnień.');
      if (sData[i][sHeaders.indexOf('Status')] !== 'Wolna') throw new Error('Ta szafka jest już zajęta lub nieczynna!');
      
      let empPlec = pracownik[pHeaders.indexOf('Płeć')];
      let szatniaPlec = sData[i][sHeaders.indexOf('Płeć docelowa')];
      if (szatniaPlec !== 'Neutralna') {
         if (empPlec === 'Mężczyzna' && szatniaPlec === 'Damska') throw new Error('Nie można przydzielić damskiej szafki mężczyźnie!');
         if (empPlec === 'Kobieta' && szatniaPlec === 'Męska') throw new Error('Nie można przydzielić męskiej szafki kobiecie!');
      }
      
      const mapping = {
        'Kod pracownika': 'Kod', 'Nazwisko': 'Nazwisko', 'Imię': 'Imię',
        'Dział pracownika': 'Dział', 'Stanowisko': 'Stanowisko', 
        'Płeć': 'Płeć', 'Zmiana': 'Zmiana', 'Zatrudniony': 'Zatrudniony'
      };
      
      for (let sCol in mapping) {
         let sIdx = sHeaders.indexOf(sCol);
         let pIdx = pHeaders.indexOf(mapping[sCol]);
         if(sIdx > -1 && pIdx > -1) szafkiSheet.getRange(i + 1, sIdx + 1).setValue(pracownik[pIdx]);
      }
      
      szafkiSheet.getRange(i + 1, sHeaders.indexOf('Status') + 1).setValue('Zajęta');
      zapiszHistorie(idSzafki, 'Przydział', access.email, `Przypisano szafkę: ${kodPracownika}`);
      return { success: true };
    }
  }
  return { success: false, message: 'Nie znaleziono szafki.' };
}

function zapiszHistorie(idSzafki, typ, uzytkownik, szczegoly) {
  getDB().getSheetByName('Historia').appendRow([new Date(), idSzafki, typ, uzytkownik, szczegoly]);
}

function autoImportZDrive() {
  try {
    const plik = DriveApp.getFileById(PRAC_CSV_ID);
    const csvString = plik.getBlob().getDataAsString('UTF-8');
    
    const linie = csvString.trim().split('\n');
    const pierwszaLinia = linie.length > 0 ? linie[0] : '';
    
    const iloscSrednikow = (pierwszaLinia.match(/;/g) || []).length;
    const iloscTabulatorow = (pierwszaLinia.match(/\t/g) || []).length;
    const iloscPrzecinkow = (pierwszaLinia.match(/,/g) || []).length;
    
    let separator = ';'; 
    if (iloscTabulatorow > iloscSrednikow && iloscTabulatorow > iloscPrzecinkow) {
        separator = '\t';
    } else if (iloscPrzecinkow > iloscSrednikow && iloscPrzecinkow > iloscTabulatorow) {
        separator = ',';
    }
    
    const csvDane = Utilities.parseCsv(csvString, separator);
    const sheet = getDB().getSheetByName('Pracownicy');
    sheet.clearContents();
    sheet.appendRow(['Kod', 'Nazwisko', 'Imię', 'Stanowisko', 'Dział', 'Płeć', 'Data zatrudnienia', 'Zatrudniony', 'Zmiana']);
    
    const gotoweDane = [];
    const aktualnyRok = new Date().getFullYear();
    
    for (let i = 1; i < csvDane.length; i++) {
      if (csvDane[i].length >= 9 && csvDane[i][0] !== "") {
        const dataZwol = csvDane[i][7] ? csvDane[i][7].trim() : "";
        let isEmployed = true;
        
        let doImportu = false;
        if (dataZwol === "") {
           doImportu = true;
        } else {
           let match = dataZwol.match(/\d{4}/);
           if (match && parseInt(match[0]) >= aktualnyRok) doImportu = true;
           let p = dataZwol.split('.');
           if(p.length === 3) {
              let d = new Date(p[2], p[1]-1, p[0]);
              d.setHours(23, 59, 59);
              if (d < new Date()) isEmployed = false;
           }
        }
        
        if (doImportu) {
          let zm = csvDane[i][8] ? csvDane[i][8].trim() : "";
          if (zm.startsWith("Standard")) zm = "Standard";
          gotoweDane.push([csvDane[i][0], csvDane[i][1], csvDane[i][2], csvDane[i][3], csvDane[i][4], csvDane[i][5], csvDane[i][6], isEmployed, zm]);
        }
      }
    }
    
    gotoweDane.push(['999999', 'Agencja', 'Pracy', 'Tymczasowy', 'HUTNICZA', 'Neutralna', '01.01.2020', true, 'Standard']);
    if (gotoweDane.length > 0) {
      sheet.getRange(2, 1, gotoweDane.length, 1).setNumberFormat('@');
      sheet.getRange(2, 1, gotoweDane.length, 9).setValues(gotoweDane);
      sheet.getRange(2, 8, gotoweDane.length, 1).insertCheckboxes();
    }
    
    let nazwaSeparatora = separator === '\t' ? 'TABULATOR' : (separator === ';' ? 'ŚREDNIK' : 'PRZECINEK');
    zapiszHistorie(0, 'Import CSV', 'Auto-Trigger', `Zaimportowano ${gotoweDane.length} osób (Wykryto separator: ${nazwaSeparatora})`);
  } catch (e) { Logger.log(e.message); }
}

function getAdminActivity() {
  const access = getUserAccess();
  if (access.role !== 'admin') throw new Error('Brak uprawnień admina.');

  const db = getDB();
  const uprawnienia = db.getSheetByName('Uprawnienia').getDataRange().getValues();
  const historiaSheet = db.getSheetByName('Historia');
  
  let historiaData = [];
  if (historiaSheet) historiaData = historiaSheet.getDataRange().getDisplayValues();

  let userHistory = {};
  let allLogs = []; 

  for (let i = 1; i < historiaData.length; i++) {
     let row = historiaData[i];
     let u = row[3] ? row[3].toString().toLowerCase().trim() : '';
     if (!u) continue;

     if (!userHistory[u]) {
         userHistory[u] = { data: 'Brak akcji', typ: '-', szczegoly: '-', logins: 0, actions: 0 };
     }

     if (row[2] === 'Logowanie') {
         userHistory[u].logins++;
     } else {
         userHistory[u].actions++;
     }

     userHistory[u].data = row[0];
     userHistory[u].typ = row[2];
     userHistory[u].szczegoly = row[4];

     // Dodanie loga do bazy szczegółowej
     allLogs.push({
         data: row[0],
         idSzafki: row[1],
         typ: row[2],
         email: u,
         szczegoly: row[4]
     });
  }

  let stats = [];
  for (let i = 1; i < uprawnienia.length; i++) {
     let email = uprawnienia[i][0].toString().trim();
     if(!email) continue;
     let h = userHistory[email.toLowerCase()] || { data: 'Brak akcji', typ: '-', szczegoly: '-', logins: 0, actions: 0 };
     stats.push({ 
       email: email, 
       dzial: uprawnienia[i][1], 
       rola: uprawnienia[i][2], 
       data: h.data, 
       typ: h.typ, 
       szczegoly: h.szczegoly,
       logins: h.logins,
       actions: h.actions
     });
  }
  
  // Najnowsze logi na górze
  allLogs.reverse();

  return { stats: stats, rawLogs: allLogs };
}

function logAppOpen() {
  const access = getUserAccess();
  if (access.authorized) {
    zapiszHistorie(0, 'Logowanie', access.email, 'Uruchomienie aplikacji');
  }
}
