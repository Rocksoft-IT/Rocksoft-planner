---
change_id: allocation-edited-by
title: Show who added an allocation to a person (edited by)
client: wojciech.drozdzik@rocksoft.pl
repository:
  name: RS Planner
  git_url: git@github.com:Rocksoft-IT/Rocksoft-planner.git
status: impl_reviewed
created: 2026-06-18
updated: 2026-08-19
archived_at: null
---

## Notes

dodaj zmiany w moim narzędziu rockplanner.  Chcę widzieć kto dodał daną alokację do konkretnej osoby (edited by: person)

### 2026-07-16 — doprecyzowanie

Chcę widzieć kto dodał dany projekt do tej osoby (edited by: person). Wchodząc w szczegóły alokacji, chcę mieć opis kto ostatni dodał tę zmianę. Pozwoli mi to określić, który manager zarządził danym projektem. W razie potrzeby zmiany alokacji lub przypisania tej osoby do innego projektu wiem do kogo się zgłosić.

Zmiana ma się wyświetlać dla wszystkich alokacji w widoku /timeline. Informacja ma być dostępna na dole, po wejściu w konkretną alokację.

### 2026-07-16 — implementacja

Wykorzystano istniejącą (ale wcześniej niewypełnianą) kolumnę `allocations.created_by`
— **bez migracji bazy**. Zmiany:

- `AllocationModal` przy tworzeniu alokacji zapisuje `created_by = auth.getUser().id`
  (autor pozostaje niezmienny przy późniejszej edycji — to manager, który przydzielił projekt).
- Zapytania timeline (server `page.tsx` + client `refresh`) dociągają autora z `profiles`
  przez embed `creator:profiles!created_by(id, full_name, email)`.
- Na dole panelu szczegółów alokacji dodano stopkę „Dodane przez: <imię> · <data>".
  Dla alokacji utworzonych przed tą zmianą (`created_by = null`) wyświetla się informacja
  o braku danych.

Ograniczenie świadome: pokazujemy **twórcę** alokacji (kto przydzielił projekt), nie „ostatniego
edytującego". Śledzenie ostatniej edycji wymagałoby dodatkowej kolumny `updated_by` i migracji.

### 2026-07-16 — rozszerzenie: ostatnio edytujący (wymaga migracji bazy)

Na życzenie klienta dodano śledzenie **ostatniego edytującego** (nie tylko twórcy).
Wymaga to zmiany w bazie:

- **Migracja** `migrations/2026-07-16-allocation-updated-by.sql`: nowa kolumna
  `allocations.updated_by` (FK → `profiles`) + backfill z `created_by`. Trzeba ją uruchomić
  w Supabase SQL Editor **przed/wraz z** deployem kodu — inaczej zapis alokacji zwróci błąd.
- `AllocationModal`: `updated_by` = zalogowany user przy tworzeniu **i** edycji;
  przy edycji odświeżany też `updated_at`.
- Zapytania timeline dociągają edytującego: embed `editor:profiles!updated_by(...)`.
- Stopka panelu: główna linia „Ostatnio edytowane przez: <imię> · <data>", pod nią
  wyszarzone „Utworzone przez: <imię> · <data>".

Ten zakres zastępuje wcześniejszy PR #45 (sama wersja z twórcą). #45 należy zamknąć.

### 2026-07-20 — fix: stemplowanie autora w bazie (trigger)

Po wdrożeniu #46 okazało się, że `created_by`/`updated_by` zapisywały się jako `NULL`
(bez błędu) — klient (`supabase.auth.getUser()` w przeglądarce) nie zwracał zalogowanego
użytkownika, mimo że samo żądanie było uwierzytelnione. Diagnoza na danych: świeżo
edytowane wiersze miały `updated_by = NULL`, brak błędu zapisu.

Naprawa **po stronie bazy** (niezależna od klienta):

- `migrations/2026-07-20-allocation-actor-trigger.sql` + odpowiedni fragment w
  `supabase-schema.sql`: funkcja `set_allocation_actor()` + trigger `allocations_set_actor`
  `before insert or update`, który stempluje `created_by`/`updated_by` z `auth.uid()`.
  Lookup do `profiles` pełni rolę guardu na klucz obcy (zwraca poprawne id albo `NULL`).
- Zweryfikowane na produkcji: po dodaniu triggera edycja pokazuje „Ostatnio edytowane
  przez <użytkownik>".

Uwaga: stare alokacje pokazują „Brak informacji o ostatniej edycji" do pierwszej edycji.
