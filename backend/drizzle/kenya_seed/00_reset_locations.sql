DELETE FROM kenya_location_neighbors WHERE location_id IN (SELECT id FROM kenya_locations WHERE source = 'GEONAMES');
DELETE FROM kenya_locations WHERE source = 'GEONAMES';
