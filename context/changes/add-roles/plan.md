# Plan: dodaj nowe role — Administration Support oraz Mobile Developer

## Cel

Dopisać dwie nowe role do listy wyboru stanowisk w RS Planner, obok istniejących.
Nowe role: **Administration Support** i **Mobile Developer**.

## Ustalenia (research)

- **Jedyne źródło prawdy** dla listy ról to stała `ROLES` w
  `src/components/ui/RoleSelect.tsx`.
- Konsumenci `ROLES` (importują tę samą stałą, więc zmiana propaguje się sama):
  - `src/components/timeline/Timeline.tsx` — grupowanie/liczniki po rolach.
  - `src/app/(dashboard)/people/PeopleClient.tsx` — sekcje listy osób.
- **Baza danych: brak enuma, brak CHECK.** Kolumna `profiles.role` to
  `text not null default ''`. Rola osoby jest przechowywana jako string
  rozdzielony przecinkami (multi-select). → **Migracja SQL nie jest potrzebna.**

## Zakres zmiany

Jedna edycja pliku `src/components/ui/RoleSelect.tsx` — dodać dwie pozycje do
tablicy `ROLES` (`Mobile Developer` przy developerach, `Administration Support`
obok `Management`).

## Weryfikacja

- `npx tsc --noEmit` — typy (przeszło, exit 0).
- `next dev` + `/people` i `/timeline` — nowe role widoczne w RoleSelect,
  sekcjach listy osób i grupowaniu timeline.

## Poza zakresem

- Brak migracji ani backfillu danych — istniejące osoby zachowują swoje role.
- Brak zmian logiki zależnej od konkretnej roli (role są opisowe).

## Progress

- [x] Dodać `Mobile Developer` i `Administration Support` do `ROLES`
- [x] `npx tsc --noEmit` przechodzi (exit 0)
- [ ] `next dev` — role widoczne na `/people` i `/timeline` (opcjonalnie)
- [x] PR przez `create_change_pr`
