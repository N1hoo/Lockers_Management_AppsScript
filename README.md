# System Szafek 2.0 (Locker Management System)

Kompleksowa aplikacja webowa typu Serverless, zbudowana w środowisku **Google Apps Script**. Służy do zautomatyzowanego zarządzania przydziałem szafek pracowniczych w zakładach pracy, w pełni wykorzystując środowisko Google Workspace bez konieczności utrzymywania zewnętrznych serwerów.

Projekt powstał jako odpowiedź na potrzebę optymalizacji procesów HR i administracji, zastępując ręczne arkusze kalkulacyjne wydajnym, dwukierunkowym interfejsem graficznym.

## Główne funkcjonalności

- **Dwukierunkowy system przydziału:** Możliwość przypisywania szafek z poziomu widoku pracownika, jak i z poziomu widoku konkretnej szafki.
- **Conflict Resolver (Ochrona przed wyścigami):** Wbudowany mechanizm wykrywający *Race Conditions*. Jeśli dwóch użytkowników spróbuje zająć tę samą szafkę w tym samym czasie, system zablokuje transakcję drugiego użytkownika, chroniąc integralność bazy danych.
- **Optymalizacja wydajności (Client-Side Rendering):** Baza danych pobierana jest asynchronicznie, a operacje takie jak przydział czy zwolnienie szafki aktualizują pamięć RAM przeglądarki (DOM) w ułamku sekundy, unikając kosztownego przeładowywania całej aplikacji.
- **Automatyczny import pracowników:** Mechanizm `Triggerów` zaciągający i parsujący najnowsze pliki CSV z Google Drive bezpośrednio do bazy. Wbudowany inteligentny analizator automatycznie wykrywa rodzaj separatora (średnik, przecinek, tabulator).
- **Zaawansowany interfejs (Tailwind CSS):** 
  - Dynamicznie regulowana szerokość kolumn (Custom Resizer w Vanilla JS).
  - Regulowany panel boczny (Split-pane) z detalami pracownika.
  - Wielo-kryteriowa, asynchroniczna wyszukiwarka (szukanie jednoczesne po imieniu, dziale, zmianie itp.).
- **Role-Based Access Control (RBAC):** Dynamiczne renderowanie widoków i dostępów w zależności od uprawnień (Admin vs. Użytkownik) oraz odizolowanie widoczności szafek pomiędzy poszczególnymi działami operacyjnymi (np. Produkcja, Zdobienie).
- **Client-Side Export:** Generowanie natywnych plików Excel (CSV w formacie UTF-8 BOM) z aktualnie przefiltrowanego widoku tabeli, w całości po stronie przeglądarki klienta.
- **Logi Aktywności (Audit Trail):** Dedykowany panel dla administratorów pozwalający śledzić ostatnie akcje w systemie.

## Technologie

- **Backend:** Google Apps Script (JavaScript/ES6), Google Sheets API, Google Drive API.
- **Frontend:** HTML5, Vanilla JavaScript, Tailwind CSS (via CDN).
- **Baza Danych:** Google Sheets (wykorzystana jako relacyjna, darmowa baza chmurowa).

## Jak to działa (Architektura)

Aplikacja opiera się na wzorcu zbliżonym do MVC. Plik `Code.gs` działa jako kontroler i backend, obsługując requesty `google.script.run` wysyłane z frontendu. 
Zamiast powolnych operacji I/O przy każdej interakcji, system w locie operuje na tablicach obiektów JSON przetrzymywanych w pamięci podręcznej przeglądarki, wykonując zapis do arkusza w sposób asynchroniczny z wymuszoną walidacją stanu (Concurrency Control).

## Uruchomienie projektu (Deployment)

Jako że projekt oparty jest na architekturze Google Workspace, nie wymaga instalacji lokalnej za pomocą Node.js czy Dockera.

1. Utwórz nowy Arkusz Google lub zaimportuj DB_szafki.ods (będzie to Twoja baza danych) wraz z wymaganymi zakładkami (`Szafki`, `Pracownicy`, `Słowniki`, `Uprawnienia`, `Historia`).
2. Otwórz edytor skryptów (Rozszerzenia -> Apps Script).
3. Wklej zawartość pliku `Code.gs` w głównym pliku backendu.
4. Utwórz nowy plik HTML o nazwie `Index.html` i wklej do niego kod frontendu.
5. Uzupełnij zmienną `DB_ID` w pliku `Code.gs` identyfikatorem swojego Arkusza.
6. Kliknij **Wdróż -> Nowe wdrożenie**, wybierz typ "Aplikacja internetowa" i przypisz uprawnienia dostępu.

## Autor
Paweł Pawłowski - Automatyzacja procesów biznesowych
