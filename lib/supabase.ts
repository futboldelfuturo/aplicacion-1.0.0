import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fbkoqwgtjwicieiltmbd.supabase.co';
const supabaseKey = 'sb_publishable_FQXcbQwNSqZAeG8TrqUJow_un9s74Np';
export const supabase = createClient(supabaseUrl, supabaseKey);