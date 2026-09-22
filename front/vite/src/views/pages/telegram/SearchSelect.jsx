import { Autocomplete, Avatar, Box, TextField, Typography } from '@mui/material';

import AuthImage from './AuthImage';

// Bolinha de status por token (troca no dark via token string).
const DOT_COLOR = {
    active: 'success.main',
    ok: 'success.main',
    online: 'success.main',
    connected: 'success.main',
    banned: 'error.main',
    error: 'error.main',
    pending: 'warning.main',
    warning: 'warning.main',
    inactive: 'text.disabled',
    paused: 'text.disabled'
};

// avatar/ícone de uma opção rica (avatarPath via proxy JWT → AuthImage; senão inicial/ícone)
function OptionAvatar({ option, size = 26 }) {
    const { label, avatarPath, icon: Icon } = option || {};
    const fallback = (
        <Avatar sx={{ width: size, height: size, fontSize: size * 0.46, fontWeight: 700, bgcolor: 'action.selected', color: 'text.secondary' }}>
            {Icon ? <Icon size={size * 0.58} /> : (label || '?').trim().charAt(0).toUpperCase()}
        </Avatar>
    );
    if (avatarPath) return <AuthImage path={avatarPath} alt={label} size={size} fallback={fallback} />;
    return fallback;
}

// Seletor com campo de busca (para listas grandes de bots/grupos).
// options: [{ value, label }] — e OPCIONALMENTE { secondary, avatarPath, icon, status }.
// value/onChange controlados por `value` (o `value` da opção).
export default function SearchSelect({
    options = [],
    value,
    onChange,
    label,
    placeholder,
    size = 'small',
    sx,
    fullWidth,
    disableClearable = true
}) {
    const selected = options.find((o) => o.value === value) || null;
    // opção "rica" = tem qualquer metadado além de value/label
    const isRich = (o) => !!(o && (o.avatarPath || o.icon || o.secondary || o.status));
    const showLead = isRich(selected);

    return (
        <Autocomplete
            options={options}
            value={selected}
            onChange={(_, v) => onChange(v ? v.value : '')}
            getOptionLabel={(o) => o?.label ?? ''}
            isOptionEqualToValue={(o, v) => o.value === v?.value}
            disableClearable={disableClearable}
            size={size}
            fullWidth={fullWidth}
            sx={sx}
            renderOption={(props, option) => {
                const { key, ...rest } = props;
                const rich = isRich(option);
                return (
                    <Box component="li" key={key} {...rest} sx={{ gap: 1.25, alignItems: 'center', py: rich ? 0.75 : 0.5 }}>
                        {rich && (option.avatarPath || option.icon) ? <OptionAvatar option={option} /> : null}
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" noWrap sx={{ fontWeight: option.secondary ? 600 : 400 }}>
                                {option.label}
                            </Typography>
                            {option.secondary ? (
                                <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block' }}>
                                    {option.secondary}
                                </Typography>
                            ) : null}
                        </Box>
                        {option.status ? (
                            <Box
                                sx={{
                                    width: 8,
                                    height: 8,
                                    flexShrink: 0,
                                    borderRadius: '50%',
                                    bgcolor: DOT_COLOR[option.status] || 'text.disabled'
                                }}
                            />
                        ) : null}
                    </Box>
                );
            }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    placeholder={placeholder}
                    InputProps={{
                        ...params.InputProps,
                        startAdornment: showLead ? (
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', pl: 0.5, mr: 0.25 }}>
                                <OptionAvatar option={selected} size={22} />
                                {selected?.status ? (
                                    <Box
                                        sx={{
                                            width: 7,
                                            height: 7,
                                            ml: 0.5,
                                            borderRadius: '50%',
                                            bgcolor: DOT_COLOR[selected.status] || 'text.disabled'
                                        }}
                                    />
                                ) : null}
                            </Box>
                        ) : (
                            params.InputProps.startAdornment
                        )
                    }}
                />
            )}
            slotProps={{ paper: { sx: { borderRadius: 2 } } }}
        />
    );
}
