using System;
using System.ComponentModel;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace AforoBridge
{
    /// <summary>Paleta y utilidades de UI (tema SRServi: negro / blanco / dorado).</summary>
    public static class Theme
    {
        public static readonly Color Bg = Color.FromArgb(18, 18, 18);
        public static readonly Color Card = Color.FromArgb(28, 28, 30);
        public static readonly Color Input = Color.FromArgb(38, 38, 41);
        public static readonly Color Border = Color.FromArgb(55, 55, 58);
        public static readonly Color Gold = Color.FromArgb(212, 175, 55);
        public static readonly Color Text = Color.White;
        public static readonly Color Muted = Color.FromArgb(150, 150, 155);

        public static GraphicsPath RoundedRect(Rectangle r, int radius)
        {
            int d = radius * 2;
            var p = new GraphicsPath();
            if (radius <= 0) { p.AddRectangle(r); p.CloseFigure(); return p; }
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }
    }

    /// <summary>Panel con esquinas redondeadas y borde sutil.</summary>
    public class Card : Panel
    {
        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public int Radius { get; set; } = 16;
        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public Color BorderColor { get; set; } = Theme.Border;

        public Card()
        {
            DoubleBuffered = true;
            BackColor = Theme.Card;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            var r = new Rectangle(0, 0, Width - 1, Height - 1);
            using var path = Theme.RoundedRect(r, Radius);
            using var b = new SolidBrush(BackColor);
            using var pen = new Pen(BorderColor);
            e.Graphics.FillPath(b, path);
            e.Graphics.DrawPath(pen, path);
        }
    }

    /// <summary>Botón tipo "pill" con esquinas redondeadas y hover.</summary>
    public class PillButton : Button
    {
        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public int Radius { get; set; } = 12;
        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public Color HoverColor { get; set; } = Color.FromArgb(60, 60, 64);
        private bool _hover;

        public PillButton()
        {
            FlatStyle = FlatStyle.Flat;
            FlatAppearance.BorderSize = 0;
            FlatAppearance.MouseOverBackColor = Color.Transparent;
            FlatAppearance.MouseDownBackColor = Color.Transparent;
            BackColor = Theme.Input;
            ForeColor = Theme.Text;
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer, true);
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            MouseEnter += (_, __) => { _hover = true; Invalidate(); };
            MouseLeave += (_, __) => { _hover = false; Invalidate(); };
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            var r = new Rectangle(0, 0, Width - 1, Height - 1);
            using var path = Theme.RoundedRect(r, Radius);
            var bg = !Enabled ? Color.FromArgb(45, 45, 48) : (_hover ? HoverColor : BackColor);
            using (var b = new SolidBrush(bg)) e.Graphics.FillPath(b, path);
            var fc = Enabled ? ForeColor : Theme.Muted;
            TextRenderer.DrawText(e.Graphics, Text, Font, r, fc,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        }
    }

    /// <summary>Campo de texto con fondo redondeado y placeholder.</summary>
    public class InputBox : Card
    {
        public TextBox Box { get; } = new();

        public InputBox(bool password = false, string placeholder = "")
        {
            Radius = 10;
            BackColor = Theme.Input;
            BorderColor = Theme.Border;
            Height = 42;
            Box.BorderStyle = BorderStyle.None;
            Box.BackColor = BackColor;
            Box.ForeColor = Theme.Text;
            Box.Font = new Font("Segoe UI", 10.5f);
            Box.UseSystemPasswordChar = password;
            if (!string.IsNullOrEmpty(placeholder)) Box.PlaceholderText = placeholder;
            Controls.Add(Box);
            Resize += (_, __) => Reposition();
            Reposition();
        }

        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public string Value { get => Box.Text; set => Box.Text = value; }

        private void Reposition()
        {
            Box.Left = 14;
            Box.Width = Width - 28;
            Box.Top = Math.Max(0, (Height - Box.PreferredHeight) / 2);
        }
    }

    /// <summary>Interruptor on/off grande y claramente clicable, con texto al lado.</summary>
    public class ToggleSwitch : Control
    {
        private bool _checked = true;
        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public bool Checked
        {
            get => _checked;
            set { _checked = value; Invalidate(); CheckedChanged?.Invoke(this, EventArgs.Empty); }
        }
        public event EventHandler? CheckedChanged;

        public ToggleSwitch()
        {
            SetStyle(ControlStyles.SupportsTransparentBackColor | ControlStyles.UserPaint |
                     ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer, true);
            Height = 34;
            Width = 360;
            Cursor = Cursors.Hand;
            BackColor = Color.Transparent;
            Font = new Font("Segoe UI", 9.5f);
        }

        protected override void OnClick(EventArgs e) { Checked = !_checked; base.OnClick(e); }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            const int sw = 48, sh = 26;
            int sy = (Height - sh) / 2;
            var track = new Rectangle(0, sy, sw, sh);
            using (var tb = new SolidBrush(_checked ? Theme.Gold : Color.FromArgb(70, 70, 74)))
            using (var path = Theme.RoundedRect(track, sh / 2))
                g.FillPath(tb, path);

            int kd = sh - 6;
            int kx = _checked ? sw - kd - 3 : 3;
            using (var kb = new SolidBrush(_checked ? Color.Black : Color.White))
                g.FillEllipse(kb, kx, sy + 3, kd, kd);

            if (!string.IsNullOrEmpty(Text))
                TextRenderer.DrawText(g, Text, Font, new Rectangle(sw + 12, 0, Width - sw - 12, Height),
                    Theme.Text, TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.WordEllipsis);
        }
    }

    /// <summary>ComboBox plano con tema oscuro.</summary>
    public class DarkCombo : ComboBox
    {
        public DarkCombo(bool editable = false)
        {
            FlatStyle = FlatStyle.Flat;
            DropDownStyle = editable ? ComboBoxStyle.DropDown : ComboBoxStyle.DropDownList;
            BackColor = Theme.Input;
            ForeColor = Theme.Text;
            Font = new Font("Segoe UI", 10.5f);
            Height = 40;
        }
    }
}
