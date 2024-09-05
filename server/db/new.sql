CREATE OR REPLACE FUNCTION set_module_position() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.position IS NULL THEN
        SELECT COALESCE(MAX(position), 0) + 1 INTO NEW.position FROM modules WHERE level_id = NEW.level_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- #### Trigger for Insert

CREATE OR REPLACE TRIGGER set_module_position_trigger
BEFORE INSERT ON modules
FOR EACH ROW
EXECUTE FUNCTION set_module_position();

CREATE OR REPLACE FUNCTION reorder_and_update_module() RETURNS TRIGGER AS $$
BEGIN
    -- Check if the control variable is set, if so, exit early to prevent recursion
    IF current_setting('custom.trigger_disable', true) = 'true' THEN
        RETURN NEW;
    END IF;

    -- Set the control variable to prevent recursive triggers
    PERFORM set_config('custom.trigger_disable', 'true', true);

    -- Perform the reorder logic based on OLD and NEW positions
    IF NEW.position < OLD.position THEN
        UPDATE modules
        SET position = position + 1
        WHERE level_id = NEW.level_id AND position >= NEW.position AND position < OLD.position;
    ELSE
        UPDATE modules
        SET position = position - 1
        WHERE level_id = NEW.level_id AND position <= NEW.position AND position > OLD.position;
    END IF;

    -- Reset the control variable to allow further triggers
    PERFORM set_config('custom.trigger_disable', 'false', true);

    -- Return the NEW row to finalize the update
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- #### Trigger for Update
CREATE OR REPLACE TRIGGER handle_update_module_position_trigger
BEFORE UPDATE ON modules
FOR EACH ROW
WHEN (OLD.position IS DISTINCT FROM NEW.position)
EXECUTE FUNCTION reorder_and_update_module();

-- ### Lessons Table

CREATE OR REPLACE FUNCTION set_lesson_position() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.position IS NULL THEN
        SELECT COALESCE(MAX(position), 0) + 1 INTO NEW.position FROM lessons WHERE module_id = NEW.module_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- #### Trigger for Insert
CREATE OR REPLACE TRIGGER set_lesson_position_trigger
BEFORE INSERT ON lessons
FOR EACH ROW
EXECUTE FUNCTION set_lesson_position();

-- #### Function for Reordering on Update
CREATE OR REPLACE FUNCTION reorder_and_update_lesson() RETURNS TRIGGER AS $$
BEGIN
    -- Check if the control variable is set, if so, exit early to prevent recursion
    IF current_setting('custom.trigger_disable', true) = 'true' THEN
        RETURN NEW;
    END IF;

    -- Set the control variable to prevent recursive triggers
    PERFORM set_config('custom.trigger_disable', 'true', true);

    -- Perform the reorder logic based on OLD and NEW positions
    IF NEW.position < OLD.position THEN
        UPDATE lessons
        SET position = position + 1
        WHERE module_id = NEW.module_id AND position >= NEW.position AND position < OLD.position;
    ELSE
        UPDATE lessons
        SET position = position - 1
        WHERE module_id = NEW.module_id AND position <= NEW.position AND position > OLD.position;
    END IF;

    -- Reset the control variable to allow further triggers
    PERFORM set_config('custom.trigger_disable', 'false', true);

    -- Return the NEW row to finalize the update
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- #### Trigger for Update
CREATE OR REPLACE TRIGGER handle_update_lesson_position_trigger
BEFORE UPDATE ON lessons
FOR EACH ROW
WHEN (OLD.position IS DISTINCT FROM NEW.position)
EXECUTE FUNCTION reorder_and_update_lesson();

-- ### Parts Table

-- #### Function to Set Position on Insert
CREATE OR REPLACE FUNCTION set_part_position() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.position IS NULL THEN
        SELECT COALESCE(MAX(position), 0) + 1 INTO NEW.position FROM parts WHERE lesson_id = NEW.lesson_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- #### Trigger for Insert
CREATE OR REPLACE TRIGGER set_part_position_trigger
BEFORE INSERT ON parts
FOR EACH ROW
EXECUTE FUNCTION set_part_position();

-- #### Function for Reordering on Update
CREATE OR REPLACE FUNCTION reorder_and_update_part() RETURNS TRIGGER AS $$
BEGIN
    -- Check if the control variable is set, if so, exit early to prevent recursion
    IF current_setting('custom.trigger_disable', true) = 'true' THEN
        RETURN NEW;
    END IF;

    -- Set the control variable to prevent recursive triggers
    PERFORM set_config('custom.trigger_disable', 'true', true);

    -- Perform the reorder logic based on OLD and NEW positions
    IF NEW.position < OLD.position THEN
        UPDATE parts
        SET position = position + 1
        WHERE lesson_id = NEW.lesson_id AND position >= NEW.position AND position < OLD.position;
    ELSE
        UPDATE parts
        SET position = position - 1
        WHERE lesson_id = NEW.lesson_id AND position <= NEW.position AND position > OLD.position;
    END IF;

    -- Reset the control variable to allow further triggers
    PERFORM set_config('custom.trigger_disable', 'false', true);

    -- Return the NEW row to finalize the update
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- #### Trigger for Update
CREATE OR REPLACE TRIGGER handle_update_part_position_trigger
BEFORE UPDATE ON parts
FOR EACH ROW
WHEN (OLD.position IS DISTINCT FROM NEW.position)
EXECUTE FUNCTION reorder_and_update_part();

-- ### Activities Table

-- #### Function to Set Position on Insert
CREATE OR REPLACE FUNCTION set_activity_position() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.position IS NULL THEN
        SELECT COALESCE(MAX(position), 0) + 1 INTO NEW.position FROM activities WHERE part_id = NEW.part_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- #### Trigger for Insert
CREATE OR REPLACE TRIGGER set_activity_position_trigger
BEFORE INSERT ON activities
FOR EACH ROW
EXECUTE FUNCTION set_activity_position();

-- #### Function for Reordering on Update
CREATE OR REPLACE FUNCTION reorder_and_update_activity() RETURNS TRIGGER AS $$
BEGIN
    -- Check if the control variable is set, if so, exit early to prevent recursion
    IF current_setting('custom.trigger_disable', true) = 'true' THEN
        RETURN NEW;
    END IF;

    -- Set the control variable to prevent recursive triggers
    PERFORM set_config('custom.trigger_disable', 'true', true);

    -- Perform the reorder logic based on OLD and NEW positions
    IF NEW.position < OLD.position THEN
        UPDATE activities
        SET position = position + 1
        WHERE part_id = NEW.part_id AND position >= NEW.position AND position < OLD.position;
    ELSE
        UPDATE activities
        SET position = position - 1
        WHERE part_id = NEW.part_id AND position <= NEW.position AND position > OLD.position;
    END IF;

    -- Reset the control variable to allow further triggers
    PERFORM set_config('custom.trigger_disable', 'false', true);

    -- Return the NEW row to finalize the update
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- #### Trigger for Update
CREATE OR REPLACE TRIGGER handle_update_activity_position_trigger
BEFORE UPDATE ON activities
FOR EACH ROW
WHEN (OLD.position IS DISTINCT FROM NEW.position)
EXECUTE FUNCTION reorder_and_update_activity();
