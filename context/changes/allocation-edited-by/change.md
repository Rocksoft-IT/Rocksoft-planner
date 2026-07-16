---
change_id: allocation-edited-by
title: Show who added an allocation to a person (edited by)
client: wojciech.drozdzik@rocksoft.pl
repository:
  name: RS Planner
  git_url: git@github.com:Rocksoft-IT/Rocksoft-planner.git
status: in-progress
created: 2026-06-18
updated: 2026-07-16
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
